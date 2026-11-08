<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\StaffAccount;
use App\Services\AuditLog;
use Illuminate\Contracts\Auth\PasswordBroker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rules\Password as PasswordRule;

/** Forgotten password for a staff account (REQ-F-88, N-11). Same steps as the User reset of #15. */
class StaffPasswordController extends Controller
{
    public function email(Request $request): JsonResponse
    {
        $input = $request->validate(['email' => ['required', 'string', 'email', 'max:255']]);
        dispatch(function () use ($input) {
            $account = $this->account($input['email']);
            if ($account !== null) {
                $this->broker()->sendResetLink(['email' => $account->email]);
            }
        })->afterResponse();

        // Sent after the answer, so neither the answer nor its timing reveals an account.
        return response()->json(['status' => 'received']);
    }

    public function validateLink(Request $request): Response
    {
        $input = $request->validate($this->linkRules());
        $account = $this->account($input['email']);
        if ($account === null || ! $this->broker()->tokenExists($account, $input['token'])) {
            throw new ApiException('staff_reset_link_invalid', 422);
        }

        return response()->noContent();
    }

    public function reset(Request $request, AuditLog $log): Response
    {
        $input = $request->validate([
            ...$this->linkRules(),
            'password' => ['required', 'string', 'max:255', 'confirmed', PasswordRule::min(10)->uncompromised()],
            'password_confirmation' => ['required', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($input, $log) {
            $account = $this->account($input['email'], lock: true);
            if ($account === null) {
                throw new ApiException('staff_reset_link_invalid', 422);
            }
            $status = $this->broker()->reset([...$input, 'email' => $account->email], function (StaffAccount $account, string $password) use ($log) {
                // A new password changes the fingerprint every staff sign-in carries, so all of them end (#84).
                $account->forceFill(['password' => $password])->save();
                $log->record('staff.password_reset', $account, by: $account);
            });
            if ($status !== Password::PasswordReset) {
                throw new ApiException('staff_reset_link_invalid', 422);
            }
        });

        return response()->noContent();
    }

    private function broker(): PasswordBroker
    {
        return Password::broker('staff_accounts');
    }

    private function linkRules(): array
    {
        return ['email' => ['required', 'string', 'email', 'max:255'], 'token' => ['required', 'string', 'max:255']];
    }

    /** Only accounts that can sign in: invited people use their invitation, deactivated ones ask an Administrator. */
    private function account(string $email, bool $lock = false): ?StaffAccount
    {
        $query = StaffAccount::query()->whereRaw('lower(email) = lower(?)', [$email])
            ->whereNull('deactivated_at')->whereNotNull('password');

        return ($lock ? $query->lockForUpdate() : $query)->first();
    }
}
