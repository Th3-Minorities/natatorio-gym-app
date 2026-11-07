<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\StaffAccount;
use Illuminate\Support\Facades\DB;

/**
 * Role changes, deactivation and reactivation of staff accounts (REQ-F-88). Each one locks the account row,
 * so two Administrators acting at once see each other's change, and writes its audit log entry.
 */
class StaffAccountChanges
{
    public function __construct(private AuditLog $log) {}

    public function changeRole(StaffAccount $account, string $role): StaffAccount
    {
        return DB::transaction(function () use ($account, $role) {
            $account = $this->locked($account);
            if ($account->status() !== 'active') {
                throw new ApiException('staff_account_status_changed', 409);
            }
            if ($account->role !== $role) {
                $before = $account->only('role');
                $account->forceFill(['role' => $role])->save();
                $this->log->record('staff.role_change', $account, $before, $account->only('role'));
            }

            return $account;
        });
    }

    /** The account can no longer sign in, and its open sign-ins end on their next request (E-130). */
    public function deactivate(StaffAccount $account): StaffAccount
    {
        return DB::transaction(function () use ($account) {
            // Every active Administrator is locked in id order, so two deactivations at once wait for each other.
            $admins = StaffAccount::query()->where('role', 'admin')->whereNull('deactivated_at')
                ->whereNotNull('password')->orderBy('id')->lockForUpdate()->pluck('id');
            $account = $this->locked($account);
            $before = $account->status();
            if ($before === 'deactivated') {
                throw new ApiException('staff_account_status_changed', 409);
            }
            if ($before === 'active' && $account->role === 'admin' && $admins->diff([$account->id])->isEmpty()) {
                throw new ApiException('staff_last_administrator', 409);
            }
            $account->forceFill(['deactivated_at' => now()])->save();
            $this->log->record('staff.deactivate', $account, ['status' => $before], ['status' => $account->status()]);

            return $account;
        });
    }

    /** The person signs in again with the same email and password (E-150). */
    public function reactivate(StaffAccount $account): StaffAccount
    {
        return DB::transaction(function () use ($account) {
            $account = $this->locked($account);
            if ($account->status() !== 'deactivated') {
                throw new ApiException('staff_account_status_changed', 409);
            }
            $account->forceFill(['deactivated_at' => null])->save();
            $this->log->record('staff.reactivate', $account, ['status' => 'deactivated'], ['status' => $account->status()]);

            return $account;
        });
    }

    private function locked(StaffAccount $account): StaffAccount
    {
        return StaffAccount::query()->lockForUpdate()->findOrFail($account->id);
    }
}
