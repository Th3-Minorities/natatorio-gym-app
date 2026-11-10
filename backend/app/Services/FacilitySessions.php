<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\FacilitySession;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class FacilitySessions
{
    // Terms include ends_on. Find the term by Check In time, even after its authorization is deleted.
    // PostgreSQL and Laravel both use America/Puerto_Rico (config/database.php).
    private const TERM_END = '(SELECT (academic_terms.ends_on + 1)::timestamptz FROM academic_terms
        WHERE facility_sessions.started_at::date BETWEEN academic_terms.starts_on AND academic_terms.ends_on)';

    // E-169: a dated closure ends the visit when it starts, or when it is published if it had already started.
    // That moment (the later of starts_at and created_at) must fall in [started_at, the 2-hour expiry or term end),
    // so a visit that began during an already published closure is not ended. A closure that is over by then does not count. Weekly rows (starts_at NULL) never match.
    private const CLOSURE_START = "(SELECT MIN(closure_slots.effective_at) FROM (
        SELECT GREATEST(starts_at, created_at) AS effective_at FROM schedule_slots
        WHERE type = 'closure' AND starts_at IS NOT NULL AND ends_at > GREATEST(starts_at, created_at)) AS closure_slots
        WHERE closure_slots.effective_at >= facility_sessions.started_at
        AND closure_slots.effective_at < LEAST(facility_sessions.ends_at, COALESCE(".self::TERM_END.", 'infinity'::timestamptz)))";

    /** The most recent visit that has ended (voided ones are never shown), or null. */
    public function lastEndedFor(User $user): ?FacilitySession
    {
        // At most one session is active (exclusion constraint), so the second row is always an ended one.
        return $this->query()->where('user_id', $user->id)->where('status', '<>', 'void')
            ->orderByDesc('started_at')->orderByDesc('id')->limit(2)->get()
            ->map(fn (FacilitySession $session) => $this->resolveEnd($session))
            ->first(fn (FacilitySession $session) => $session->status !== 'active');
    }

    public function activeFor(User $user): ?FacilitySession
    {
        $now = $this->databaseNow();

        return $this->whereActive($this->query()->where('user_id', $user->id), $now)
            ->orderByDesc('started_at')->orderByDesc('id')->first();
    }

    /** Visits inside the gym now. Same rule as activeFor(), for everyone, so a closure or term end counts before the scheduler runs. */
    public function occupancy(Carbon $now): int
    {
        return $this->whereActive(FacilitySession::query(), $now)->where('started_at', '<=', $now->format('Y-m-d H:i:s.uP'))->count();
    }

    /**
     * @param  Builder<FacilitySession>  $query
     * @return Builder<FacilitySession>
     */
    private function whereActive(Builder $query, Carbon $now): Builder
    {
        $at = $now->format('Y-m-d H:i:s.uP');

        return $query->where('status', 'active')
            ->where('ends_at', '>', $at)
            ->whereRaw('('.self::TERM_END.' IS NULL OR '.self::TERM_END.' > ?)', [$at])
            ->whereRaw('('.self::CLOSURE_START.' IS NULL OR '.self::CLOSURE_START.' > ?)', [$at]);
    }

    public function checkOut(string $id, StaffAccount $staff): FacilitySession
    {
        return DB::transaction(function () use ($id, $staff) {
            $session = $this->query()->whereKey($id)->lockForUpdate()->firstOrFail();
            // Resolve time after obtaining the lock: waiting for another writer must not allow a late exit.
            $now = $this->databaseNow();
            $this->resolveEnd($session, $now);
            if ($session->status !== 'active') {
                throw new ApiException('check_out_session_not_active', 409);
            }

            // Written by PostgreSQL so it rounds like started_at's default; a PHP-formatted value would truncate
            // and could land before started_at on an immediate exit.
            DB::table('facility_sessions')->where('id', $session->id)->update([
                'status' => 'checked_out',
                'ended_at' => DB::raw('clock_timestamp()'),
                'checked_out_by_staff_account_id' => $staff->id,
                'updated_at' => $now->format('Y-m-d H:i:s.uP'),
            ]);

            // The columns are timestamptz(0): answer with the stored value, not the sub-second clock reading.
            return $session->refresh();
        });
    }

    /** Three conditional bulk updates; no session rows are loaded into memory. Safe to repeat. */
    public function closeDue(?Carbon $at = null): void
    {
        $this->materializeDue($at, null);
    }

    /**
     * The same closes for one User. Check In runs it before inserting: a session that a term end or a closure has
     * already ended but still has no ended_at would otherwise collide with the new one (exclusion constraint).
     */
    public function closeDueFor(User $user): void
    {
        $this->materializeDue(null, $user);
    }

    private function materializeDue(?Carbon $at, ?User $user): void
    {
        $now = $at?->copy()->setTimezone(config('app.timezone')) ?? $this->databaseNow();
        $timestamp = $now->format('Y-m-d H:i:s.uP');
        $active = fn () => DB::table('facility_sessions')->where('status', 'active')
            ->when($user, fn ($query) => $query->where('user_id', $user->id));

        DB::transaction(function () use ($timestamp, $active) {
            // A closure that has started is strictly earlier than the term end and the expiry (see CLOSURE_START), so it
            // goes first and the updates below only see what is still active.
            $active()
                ->whereRaw(self::CLOSURE_START.' <= ?', [$timestamp])
                ->update(['status' => 'closed', 'ended_at' => DB::raw(self::CLOSURE_START), 'updated_at' => $timestamp]);

            // The first event wins if the scheduler was delayed. A simultaneous term end closes the visit.
            $active()
                ->whereRaw(self::TERM_END.' <= ends_at')
                ->whereRaw(self::TERM_END.' <= ?', [$timestamp])
                ->update(['status' => 'closed', 'ended_at' => DB::raw(self::TERM_END), 'updated_at' => $timestamp]);

            // Expiry already has a stored end time: ends_at. Its ended_at stays NULL by the schema's rule.
            $active()->where('ends_at', '<=', $timestamp)
                ->update(['status' => 'expired', 'updated_at' => $timestamp]);
        });
    }

    public function data(FacilitySession $session): array
    {
        return [
            'id' => $session->id,
            'started_at' => $session->started_at->toISOString(),
            'status' => $session->status,
            'ended_at' => $session->ended_at?->toISOString(),
            'end_reason' => $this->endReason($session),
        ];
    }

    public function lastData(FacilitySession $session): array
    {
        return [
            'id' => $session->id,
            'started_at' => $session->started_at->toISOString(),
            'ended_at' => $session->ended_at?->toISOString(),
            'end_reason' => $this->endReason($session),
        ];
    }

    /** Staff ending a visit early means the same to the person as a check-out. */
    private function endReason(FacilitySession $session): ?string
    {
        return match ($session->status) {
            'active' => null,
            'ended_early' => 'checked_out',
            default => $session->status,
        };
    }

    /** @return Builder<FacilitySession> */
    private function query(): Builder
    {
        return FacilitySession::query()->select('facility_sessions.*')
            ->selectRaw(self::TERM_END.' AS term_ends_at')->selectRaw(self::CLOSURE_START.' AS closure_starts_at')
            ->withCasts(['term_ends_at' => 'datetime', 'closure_starts_at' => 'datetime']);
    }

    /** Read the effective state without waiting for the scheduler or changing a historical row. */
    private function resolveEnd(FacilitySession $session, ?Carbon $now = null): FacilitySession
    {
        $now ??= $this->databaseNow();
        /** @var Carbon|null $termEnd */
        $termEnd = $session->term_ends_at;
        /** @var Carbon|null $closureStart */
        $closureStart = $session->closure_starts_at;
        if ($session->status === 'active') {
            if ($closureStart && $closureStart <= $now) {
                $session->status = 'closed';
                $session->ended_at = $closureStart;
            } elseif ($termEnd && $termEnd <= $now && $termEnd <= $session->ends_at) {
                $session->status = 'closed';
                $session->ended_at = $termEnd;
            } elseif ($session->ends_at <= $now) {
                $session->status = 'expired';
            }
        }
        if ($session->status === 'expired') {
            $session->ended_at = $session->ends_at;
        }

        return $session;
    }

    private function databaseNow(): Carbon
    {
        // Unlike now(), this advances while a transaction waits for a row lock.
        return Carbon::parse(DB::selectOne('SELECT clock_timestamp() AS time')->time);
    }
}
