<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\User;
use App\Services\FacilitySessions;
use App\Services\GymSchedule;
use App\Support\GymBoundary;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Check In with location (REQ-F-33, REQ-F-36, REQ-F-37). The checks run in the order of check-in-flows D1.
 * The coordinates are used only in memory and never stored or logged (REQ-NF-03).
 */
class CheckInController extends Controller
{
    public function __construct(private FacilitySessions $sessions, private GymSchedule $schedule) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user('web');

        $last = $this->sessions->lastEndedFor($user);

        return response()->json([
            ...$this->body($this->activeSession($user), $user),
            'last_session' => $last ? $this->sessions->lastData($last) : null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user('web');
        // No location is asked when a session is open (REQ-F-37), so bad numbers do not matter then.
        if ($session = $this->activeSession($user)) {
            return response()->json($this->body($session, $user));
        }
        $location = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
        ]);

        try {
            [$session, $created] = DB::transaction(function () use ($user, $location) {
                if ($session = $this->activeSession($user)) {
                    return [$session, false];
                }
                $authorization = $this->checkEligibility($user, $location);
                // A term end or closure may have ended a visit before the scheduler ran; free its time range first.
                $this->sessions->closeDueFor($user);
                $session = FacilitySession::query()->create([
                    'user_id' => $user->id,
                    'authorization_id' => $authorization->id,
                    'authorization_type' => $authorization->type,
                    'member_group' => $this->memberGroup($authorization),
                    'sport' => $authorization->type === 'athlete' ? $authorization->rosterRecord->sport : null,
                    'status' => 'active',
                ]);

                return [$session->fresh(), true];
            });
        } catch (QueryException $e) {
            // A simultaneous Check In won the exclusion constraint: answer with its session (REQ-F-37).
            if (($e->errorInfo[0] ?? null) !== '23P01' || ! ($session = $this->activeSession($user))) {
                throw $e;
            }
            $created = false;
        }

        return response()->json($this->body($session, $user), $created ? 201 : 200);
    }

    /** @param array<string, mixed> $location */
    private function checkEligibility(User $user, array $location): Authorization
    {
        $authorization = $user->currentAuthorization() ?? throw new ApiException('check_in_no_authorization', 403);
        if ($authorization->photo_path === null) {
            throw new ApiException('check_in_photo_required', 409);
        }
        if ($authorization->photo_pending_at !== null) {
            throw new ApiException('check_in_photo_pending', 409);
        }

        $now = now();
        // An athletes-only period outside regular hours opens the gym for athletes (G-28).
        if ($this->schedule->state($now) === 'closed') {
            throw new ApiException('check_in_gym_closed', 409);
        }
        // Manual authorizations count as paid members (E-126).
        if ($authorization->type !== 'athlete' && ($period = $this->schedule->covering($now, 'athletes_only'))) {
            throw new ApiException('check_in_athletes_only', 409, $this->period($period));
        }

        if (! isset($location['latitude'], $location['longitude'], $location['accuracy'])) {
            throw new ApiException('location_required', 422);
        }
        if ($location['accuracy'] > config('check_in.max_accuracy_meters')) {
            throw new ApiException('check_in_low_accuracy', 422);
        }
        if (! GymBoundary::contains($location['latitude'], $location['longitude'])) {
            throw new ApiException('check_in_outside_boundary', 403);
        }

        return $authorization;
    }

    /** Active until check-out, two hours, or the end of the term, even before the scheduler runs. */
    private function activeSession(User $user): ?FacilitySession
    {
        return $this->sessions->activeFor($user);
    }

    private function body(?FacilitySession $session, User $user): array
    {
        // The latest authorization in any term or status, so the app knows the kind of account without a current one.
        $authorization = Authorization::query()->select('authorizations.*')
            ->join('academic_terms', 'academic_terms.id', '=', 'authorizations.academic_term_id')
            ->where('authorizations.user_id', $user->id)
            ->orderByDesc('academic_terms.starts_on')->orderByDesc('authorizations.id')->first();

        return [
            'session' => $session ? ['id' => $session->id, 'started_at' => $session->started_at->toISOString(), 'status' => 'active'] : null,
            'athletes_period' => $this->athletesPeriod($session),
            'account_type' => $authorization ? ($authorization->type === 'athlete' ? 'athlete' : 'member') : null,
            'member_group' => $authorization ? $this->memberGroup($authorization) : null,
            // From the roster record, as the session copies it (E-147).
            'sport' => $authorization?->type === 'athlete' ? $authorization->rosterRecord->sport : null,
        ];
    }

    /** Student or employee for paid and manual authorizations (E-148); none for athletes. */
    private function memberGroup(Authorization $authorization): ?string
    {
        return match ($authorization->type) {
            'paid' => $authorization->importedMembership->member_group,
            'manual' => $authorization->member_group,
            default => null,
        };
    }

    /** The period now, or the next one within the notice minutes or before the active session ends (REQ-F-83, E-161). */
    private function athletesPeriod(?FacilitySession $session): ?array
    {
        $now = now();
        $periods = $this->schedule->periods($now)->where('type', 'athletes_only')->sortBy('starts_at');
        if ($current = $periods->first(fn ($p) => $p['starts_at'] <= $now && $now < $p['ends_at'])) {
            return ['state' => 'active', ...$this->period($current)];
        }
        // Within the notice minutes for everyone (E-161), or before the active session ends (REQ-F-83).
        $noticeEnd = $now->copy()->addMinutes(config('check_in.notice_minutes'));
        $next = $periods->first(fn ($p) => $p['starts_at'] > $now
            && ($p['starts_at'] <= $noticeEnd || ($session && $p['starts_at'] < $session->ends_at)));

        return $next ? ['state' => 'upcoming', ...$this->period($next)] : null;
    }

    /** @param array{starts_at: Carbon, ends_at: Carbon} $period */
    private function period(array $period): array
    {
        return ['starts_at' => $period['starts_at']->toISOString(), 'ends_at' => $period['ends_at']->toISOString()];
    }
}
