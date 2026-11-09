<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * The Check In rules that do not depend on where the person is, shared by the User's own Check In (REQ-F-33) and the
 * Staff-assisted one (REQ-F-46), so Staff can never let someone in that the app would refuse. The order is the one in
 * check-in-flows D1; the User's Check In checks the location after these.
 */
class CheckIns
{
    public function __construct(private FacilitySessions $sessions, private GymSchedule $schedule) {}

    /** The authorization the person may enter with now, or the refusal with its own code. */
    public function eligible(User $user): Authorization
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
            throw new ApiException('check_in_athletes_only', 409, [
                'starts_at' => $period['starts_at']->toISOString(), 'ends_at' => $period['ends_at']->toISOString(),
            ]);
        }

        return $authorization;
    }

    /**
     * Starts the visit, or answers with the open one (REQ-F-37). $check runs the remaining checks inside the
     * transaction, after the open-visit check, like the location for the User's own Check In.
     *
     * @param  callable(Authorization): void  $check
     * @return array{FacilitySession, bool} the session, and whether this call created it
     */
    public function start(User $user, ?StaffAccount $assistedBy = null, ?callable $check = null): array
    {
        try {
            return DB::transaction(function () use ($user, $assistedBy, $check) {
                if ($session = $this->sessions->activeFor($user)) {
                    return [$session, false];
                }
                $authorization = $this->eligible($user);
                if ($check) {
                    $check($authorization);
                }
                // A term end or closure may have ended a visit before the scheduler ran; free its time range first.
                $this->sessions->closeDueFor($user);
                $session = FacilitySession::query()->create([
                    'user_id' => $user->id,
                    'authorization_id' => $authorization->id,
                    'authorization_type' => $authorization->type,
                    'member_group' => self::memberGroup($authorization),
                    'sport' => $authorization->type === 'athlete' ? $authorization->rosterRecord->sport : null,
                    'status' => 'active',
                    'assisted' => $assistedBy !== null,
                ]);

                return [$session->fresh(), true];
            });
        } catch (QueryException $e) {
            // A simultaneous Check In won the exclusion constraint: answer with its session (REQ-F-37).
            if (($e->errorInfo[0] ?? null) !== '23P01' || ! ($session = $this->sessions->activeFor($user))) {
                throw $e;
            }

            return [$session, false];
        }
    }

    /** Student or employee for paid and manual authorizations (E-148); none for athletes. */
    public static function memberGroup(Authorization $authorization): ?string
    {
        return match ($authorization->type) {
            'paid' => $authorization->importedMembership->member_group,
            'manual' => $authorization->member_group,
            default => null,
        };
    }
}
