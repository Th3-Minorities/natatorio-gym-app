<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\StaffAccount;
use App\Services\AuditLog;
use App\Services\StaffAccountChanges;
use App\Services\StaffInvitations;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** The Administrator's staff accounts screen (A-15, REQ-F-88). Accounts are never deleted. */
class StaffAccountController extends Controller
{
    public function index(): JsonResponse
    {
        $accounts = StaffAccount::query()
            ->orderByRaw('CASE WHEN deactivated_at IS NOT NULL THEN 2 WHEN password IS NULL THEN 1 ELSE 0 END')
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        return response()->json(['accounts' => $accounts->map(fn (StaffAccount $a) => $this->show($a))->all()]);
    }

    public function invite(Request $request, AuditLog $log, StaffInvitations $invitations): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'role' => ['required', 'string', Rule::in(['staff', 'admin'])],
        ]);
        $validator->after(function ($validator) use ($request) {
            // The unique index ignores case (data-model.md section 5), so this check does too.
            if (! $validator->errors()->has('email') && $this->emailInUse($request->string('email'))) {
                $validator->addFailure('email', 'unique');
            }
        });
        $input = $validator->validate();

        try {
            $account = DB::transaction(function () use ($input, $log) {
                $account = StaffAccount::query()->create([
                    'name' => $input['name'],
                    'email' => $input['email'],
                    'password' => null,
                    'role' => $input['role'],
                    'locale' => config('app.locale') === 'en' ? 'en' : 'es',
                ]);
                // The email stays out of the log: the account row already has it.
                $log->record('staff.invite', $account, null, $account->only('name', 'role'));

                return $account;
            });
        } catch (UniqueConstraintViolationException) {
            // Two invitations for the same email at once: the second gets the same answer as above.
            $failed = Validator::make([], []);
            $failed->addFailure('email', 'unique');
            throw new ValidationException($failed);
        }

        $invitations->send($account);

        return response()->json(['account' => $this->show($account)], 201);
    }

    public function resendInvitation(StaffAccount $account, AuditLog $log, StaffInvitations $invitations): Response
    {
        if ($account->status() !== 'invited') {
            throw new ApiException('staff_account_not_invited', 409);
        }

        $invitations->send($account);
        $log->record('staff.invite_resend', $account);

        return response()->noContent();
    }

    public function changeRole(Request $request, StaffAccount $account, StaffAccountChanges $changes): JsonResponse
    {
        $input = $request->validate(['role' => ['required', 'string', Rule::in(['staff', 'admin'])]]);
        if ($this->isSelf($request, $account)) {
            throw new ApiException('staff_role_own_account', 409);
        }

        return response()->json(['account' => $this->show($changes->changeRole($request->user('staff'), $account, $input['role']))]);
    }

    public function deactivate(Request $request, StaffAccount $account, StaffAccountChanges $changes): JsonResponse
    {
        // Nobody locks themselves out; this also keeps the one acting as an active Administrator (E-151).
        if ($this->isSelf($request, $account)) {
            throw new ApiException('staff_deactivate_own_account', 409);
        }

        return response()->json(['account' => $this->show($changes->deactivate($request->user('staff'), $account))]);
    }

    public function reactivate(Request $request, StaffAccount $account, StaffAccountChanges $changes): JsonResponse
    {
        return response()->json(['account' => $this->show($changes->reactivate($request->user('staff'), $account))]);
    }

    private function isSelf(Request $request, StaffAccount $account): bool
    {
        return $request->user('staff')->is($account);
    }

    private function emailInUse(string $email): bool
    {
        return StaffAccount::query()->whereRaw('lower(email) = lower(?)', [$email])->exists();
    }

    /** @return array{id: int, name: string, email: string, role: string, status: string} */
    private function show(StaffAccount $account): array
    {
        return [
            'id' => $account->id,
            'name' => $account->name,
            'email' => $account->email,
            'role' => $account->role,
            'status' => $account->status(),
        ];
    }
}
