<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\StaffAccount;
use App\Services\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

/**
 * Sign in, sign out and "who am I" for staff accounts (N-11, REQ-F-52). A plain controller
 * on the staff guard, because Fortify handles one kind of account and Users need it (#15).
 */
class StaffSessionController extends Controller
{
    public function signIn(Request $request, AuditLog $log): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        // The unique index ignores case (data-model.md section 5), so the lookup does too.
        $account = StaffAccount::query()->whereRaw('lower(email) = lower(?)', [$credentials['email']])->first();

        // An invited account has no password until the person sets one (#84).
        if ($account?->password === null || ! Hash::check($credentials['password'], $account->password)) {
            throw new ApiException('staff_credentials_invalid', 422);
        }

        // Only after the right password, so nobody learns which emails belong to people who left.
        if ($account->deactivated_at !== null) {
            throw new ApiException('staff_account_deactivated', 403);
        }

        Auth::guard('staff')->login($account);
        $request->session()->regenerate();
        $log->record('staff.sign_in', $account);

        return response()->json($this->profile($account));
    }

    public function signOut(Request $request, AuditLog $log): Response
    {
        $log->record('staff.sign_out', $request->user('staff'));

        // Ends only the staff sign-in; a User sign-in in the same browser stays.
        Auth::guard('staff')->logout();
        $request->session()->regenerate(destroy: true);
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->profile($request->user('staff')));
    }

    /** @return array{name: string, email: string, role: string, locale: string} */
    private function profile(StaffAccount $account): array
    {
        return $account->only(['name', 'email', 'role', 'locale']);
    }
}
