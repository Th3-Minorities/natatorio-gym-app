<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\RosterRecord;
use App\Services\AuditLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The athlete roster: one list, entered by hand (REQ-F-49, REQ-F-51, E-116). Administrators add and edit on
 * A-05; Staff read the active athletes, read only (E-59).
 */
class RosterController extends Controller
{
    private const FIELDS = ['name', 'sport', 'student_number', 'institutional_email'];

    /** The reason a withdrawal writes on the authorizations it revokes (E-93). */
    private const REMOVED = 'removed from roster';

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'status' => ['sometimes', 'string', Rule::in(['active', 'withdrawn', 'all'])],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
        // Staff never see withdrawn athletes, whatever they ask for.
        $status = $request->user('staff')->role === 'admin' ? ($input['status'] ?? 'active') : 'active';

        $athletes = RosterRecord::query()
            ->when($status === 'active', fn (Builder $query) => $query->whereNull('removed_at'))
            ->when($status === 'withdrawn', fn (Builder $query) => $query->whereNotNull('removed_at'))
            ->when(trim((string) ($input['search'] ?? '')) !== '', fn (Builder $query) => $this->search($query, trim($input['search'])))
            ->orderBy('name')->orderBy('id')->get();

        return response()->json([
            'athletes' => $athletes->map(fn (RosterRecord $athlete) => $this->show($athlete))->all(),
            'active_count' => RosterRecord::query()->whereNull('removed_at')->count(),
        ]);
    }

    public function store(Request $request, AuditLog $log): JsonResponse
    {
        $input = $this->validated($request);

        $athlete = $this->saving($input, function () use ($input, $log) {
            $athlete = RosterRecord::query()->create($input);
            $log->record('roster.add', $athlete, null, $this->values($athlete));

            return $athlete;
        });

        return response()->json(['athlete' => $this->show($athlete)], 201);
    }

    public function update(Request $request, RosterRecord $athlete, AuditLog $log): JsonResponse
    {
        $input = $this->validated($request);

        $athlete = $this->saving($input, function () use ($input, $athlete, $log) {
            $before = $this->values($athlete);
            $athlete->fill($input)->save();
            $changed = array_flip(array_keys(array_diff_assoc($this->values($athlete), $before)));
            // Links sent to the old email, maybe a wrong one, must not create the account; a new one goes to
            // the new email (post-merge review of #157). Used links are history and stay.
            if (isset($changed['institutional_email'])) {
                EmailLink::query()->where('roster_record_id', $athlete->id)->whereNull('used_at')
                    ->whereIn('purpose', ['athlete_registration', 'athlete_link'])->delete();
            }
            if ($changed !== []) {
                $log->record('roster.update', $athlete, array_intersect_key($before, $changed),
                    array_intersect_key($this->values($athlete), $changed));
            }

            return $athlete;
        }, $athlete);

        return response()->json(['athlete' => $this->show($athlete)]);
    }

    /**
     * Withdraw (A-05 "Retirar"): the athlete's authorizations of the current and later terms are revoked with the
     * reason "removed from roster" (E-93), so the Gym ID and Check In stop at once. An open visit stays open
     * until it ends (REQ-F-49). Past terms are history and stay as they were.
     */
    public function withdraw(RosterRecord $athlete, AuditLog $log): JsonResponse
    {
        $athlete = DB::transaction(function () use ($athlete, $log) {
            $athlete = $this->locked($athlete, removed: false);
            $athlete->forceFill(['removed_at' => now()])->save();
            $this->authorizations($athlete)->where('authorizations.status', 'active')
                ->update(['status' => 'revoked', 'reason' => self::REMOVED, 'updated_at' => now()]);
            $log->record('roster.withdraw', $athlete, ['status' => 'active'], ['status' => 'withdrawn']);

            return $athlete;
        });

        return response()->json(['athlete' => $this->show($athlete)]);
    }

    /**
     * Reinstate (A-05 "Restituir", E-95): the authorizations the withdrawal revoked become active again. It needs
     * a reason of 10 characters or more, and is refused when the person already has an active authorization in
     * that term (one per User and term, E-94).
     */
    public function reinstate(Request $request, RosterRecord $athlete, AuditLog $log): JsonResponse
    {
        $input = $request->validate(['reason' => ['required', 'string', 'min:10', 'max:1000']]);

        try {
            $athlete = DB::transaction(function () use ($athlete, $input, $log) {
                $athlete = $this->locked($athlete, removed: true);
                $revoked = $this->authorizations($athlete)->where('authorizations.status', 'revoked')
                    ->where('authorizations.reason', self::REMOVED)->with('academicTerm')->get();
                foreach ($revoked as $authorization) {
                    $this->refuseSecondActive($authorization);
                    $authorization->forceFill(['status' => 'active', 'reason' => null])->save();
                }
                $athlete->forceFill(['removed_at' => null])->save();
                $log->record('roster.reinstate', $athlete, ['status' => 'withdrawn'], ['status' => 'active'], $input['reason']);

                return $athlete;
            });
        } catch (UniqueConstraintViolationException) {
            // Another active authorization appeared at the same moment: the unique index of E-94 stops this one.
            throw new ApiException('roster_reinstate_active_authorization', 409);
        }

        return response()->json(['athlete' => $this->show($athlete)]);
    }

    /** Locks the row and checks it is still in the state the screen showed. */
    private function locked(RosterRecord $athlete, bool $removed): RosterRecord
    {
        $athlete = RosterRecord::query()->whereKey($athlete->id)->lockForUpdate()->firstOrFail();
        if (($athlete->removed_at !== null) !== $removed) {
            throw new ApiException('roster_status_changed', 409);
        }

        return $athlete;
    }

    /** The athlete's authorizations in terms that have not ended. */
    private function authorizations(RosterRecord $athlete): Builder
    {
        return Authorization::query()->select('authorizations.*')
            ->join('academic_terms', 'academic_terms.id', '=', 'authorizations.academic_term_id')
            ->where('authorizations.roster_record_id', $athlete->id)
            ->where('academic_terms.ends_on', '>=', today()->toDateString());
    }

    private function refuseSecondActive(Authorization $authorization): void
    {
        $other = Authorization::query()->where('user_id', $authorization->user_id)
            ->where('academic_term_id', $authorization->academic_term_id)->where('status', 'active')->exists();
        if ($other) {
            throw new ApiException('roster_reinstate_active_authorization', 409, ['term' => ['name' => $authorization->academicTerm->name]]);
        }
    }

    /** @return array{name: string, sport: string, student_number: string, institutional_email: string} */
    private function validated(Request $request): array
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sport' => ['required', 'string', 'max:50'],
            // E-160: exactly 9 digits, whatever the first ones are.
            'student_number' => ['required', 'string', 'digits:9'],
            'institutional_email' => ['required', 'string', 'email', 'max:255'],
        ]);
        $input['institutional_email'] = mb_strtolower($input['institutional_email']);

        return $input;
    }

    /** Name in any case, or part of the student number. % and _ are searched as plain text. */
    private function search(Builder $query, string $text): void
    {
        $like = '%'.addcslashes($text, '\\%_').'%';
        $query->where(fn (Builder $query) => $query->where('name', 'ilike', $like)->orWhere('student_number', 'like', $like));
    }

    /**
     * Refuses a student number another athlete has, withdrawn athletes included (one roster, D16), naming
     * that athlete (A-05 "Número repetido"). Two saves at the same moment: the unique index stops the second.
     */
    private function saving(array $input, callable $save, ?RosterRecord $athlete = null): RosterRecord
    {
        $taken = fn () => RosterRecord::query()->where('student_number', $input['student_number'])
            ->when($athlete, fn (Builder $query) => $query->whereKeyNot($athlete->id))->first();

        if ($other = $taken()) {
            throw $this->numberTaken($other);
        }

        try {
            return DB::transaction($save);
        } catch (UniqueConstraintViolationException) {
            throw ($other = $taken()) ? $this->numberTaken($other) : new ApiException('roster_student_number_taken', 422);
        }
    }

    private function numberTaken(RosterRecord $other): ApiException
    {
        return new ApiException('roster_student_number_taken', 422, ['athlete' => ['id' => $other->id, 'name' => $other->name]]);
    }

    /** @return array{name: string, sport: string, student_number: string, institutional_email: string} */
    private function values(RosterRecord $athlete): array
    {
        return $athlete->only(self::FIELDS);
    }

    /** @return array{id: int, name: string, sport: string, student_number: string, institutional_email: string, status: string} */
    private function show(RosterRecord $athlete): array
    {
        return ['id' => $athlete->id, ...$this->values($athlete), 'status' => $athlete->removed_at === null ? 'active' : 'withdrawn'];
    }
}
