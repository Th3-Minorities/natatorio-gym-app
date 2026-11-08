<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\StaffAccount;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Role changes, deactivation and reactivation of staff accounts (REQ-F-88). Each one locks the active
 * Administrators in id order and then the account, so two Administrators acting at once see each other's
 * change and the department never loses its last Administrator (E-151). The acting Administrator is checked
 * again on those locked rows, because the route middleware read them before the lock.
 */
class StaffAccountChanges
{
    public function __construct(private AuditLog $log) {}

    public function changeRole(StaffAccount $actor, StaffAccount $account, string $role): StaffAccount
    {
        return DB::transaction(function () use ($actor, $account, $role) {
            $admins = $this->lockAdministrators($actor);
            $account = $this->locked($account);
            if ($account->status() !== 'active') {
                throw new ApiException('staff_account_status_changed', 409);
            }
            if ($account->role !== $role) {
                if ($account->role === 'admin' && $admins->diff([$account->id])->isEmpty()) {
                    throw new ApiException('staff_last_administrator', 409);
                }
                $before = $account->only('role');
                $account->forceFill(['role' => $role])->save();
                $this->log->record('staff.role_change', $account, $before, $account->only('role'), by: $actor);
            }

            return $account;
        });
    }

    /** The account can no longer sign in, and every open sign-in ends on its next request, even after a reactivation (E-130). */
    public function deactivate(StaffAccount $actor, StaffAccount $account): StaffAccount
    {
        return DB::transaction(function () use ($actor, $account) {
            $admins = $this->lockAdministrators($actor);
            $account = $this->locked($account);
            $before = $account->status();
            if ($before === 'deactivated') {
                throw new ApiException('staff_account_status_changed', 409);
            }
            if ($before === 'active' && $account->role === 'admin' && $admins->diff([$account->id])->isEmpty()) {
                throw new ApiException('staff_last_administrator', 409);
            }
            // A new session_epoch changes the fingerprint every open sign-in carries (StaffAccount::passwordFingerprint).
            $account->forceFill(['deactivated_at' => now(), 'session_epoch' => $account->session_epoch + 1])->save();
            $this->log->record('staff.deactivate', $account, ['status' => $before], ['status' => $account->status()], by: $actor);

            return $account;
        });
    }

    /** The person signs in again with the same email and password (E-150). */
    public function reactivate(StaffAccount $actor, StaffAccount $account): StaffAccount
    {
        return DB::transaction(function () use ($actor, $account) {
            $this->lockAdministrators($actor);
            $account = $this->locked($account);
            if ($account->status() !== 'deactivated') {
                throw new ApiException('staff_account_status_changed', 409);
            }
            $account->forceFill(['deactivated_at' => null])->save();
            $this->log->record('staff.reactivate', $account, ['status' => 'deactivated'], ['status' => $account->status()], by: $actor);

            return $account;
        });
    }

    /**
     * Every active Administrator is locked in id order, so two changes at once wait for each other. Returns their
     * ids, and refuses when the one acting is no longer among them.
     *
     * @return Collection<int, int>
     */
    private function lockAdministrators(StaffAccount $actor): Collection
    {
        $admins = StaffAccount::query()->where('role', 'admin')->whereNull('deactivated_at')
            ->whereNotNull('password')->orderBy('id')->lockForUpdate()->pluck('id');
        if (! $admins->contains($actor->id)) {
            throw new ApiException('forbidden', 403);
        }

        return $admins;
    }

    private function locked(StaffAccount $account): StaffAccount
    {
        return StaffAccount::query()->lockForUpdate()->findOrFail($account->id);
    }
}
