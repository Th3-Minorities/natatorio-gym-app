<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Middleware\EnsureStaffSessionIsActive;
use App\Models\AcademicTerm;
use App\Models\StaffAccount;
use App\Services\AuditLog;
use App\Services\SignInThrottle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Sign in, sign out and "who am I" for staff accounts (N-11, REQ-F-52). A plain controller
 * on the staff guard, because Fortify handles one kind of account and Users need it (#15).
 */
class StaffSessionController extends Controller
{
    public function signIn(Request $request, AuditLog $log): JsonResponse
    {
        // Sanctum starts a cookie session only for the app's own address. A page on another site gets none,
        // and gets a clear answer instead of a crash.
        if (! $request->hasSession()) {
            throw new ApiException('session_expired', 419);
        }

        $credentials = $request->validate([
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $throttle = new SignInThrottle('staff-sign-in');
        $throttle->ensureNotLocked($credentials['email'], $request->ip());

        // The unique index ignores case (data-model.md section 5), so the lookup does too.
        $account = StaffAccount::query()->whereRaw('lower(email) = lower(?)', [$credentials['email']])->first();

        // Always one password check, also for an unknown email or an invited account with no password yet (#84):
        // a shorter answer would tell which emails are staff accounts (docs/design/api-conventions.md, section 6).
        $passwordMatches = Hash::check($credentials['password'], $account?->password ?? self::standInHash());

        if ($account?->password === null || ! $passwordMatches) {
            $throttle->recordFailure($credentials['email'], $request->ip());

            throw new ApiException('staff_credentials_invalid', 422);
        }

        $throttle->clearAccount($credentials['email']);

        // Only after the right password, so nobody learns which emails belong to people who left.
        if ($account->deactivated_at !== null) {
            throw new ApiException('staff_account_deactivated', 403);
        }

        Auth::guard('staff')->login($account);
        $request->session()->regenerate();
        $request->session()->put(EnsureStaffSessionIsActive::LAST_ACTIVITY, now()->getTimestamp());
        $request->session()->put(EnsureStaffSessionIsActive::PASSWORD_FINGERPRINT, $account->passwordFingerprint());
        $log->record('staff.sign_in', $account);

        return response()->json($this->profile($account));
    }

    public function signOut(Request $request, AuditLog $log): Response
    {
        $log->record('staff.sign_out', $request->user('staff'));

        // Ends only the staff sign-in; a User sign-in in the same browser stays.
        Auth::guard('staff')->logout();
        $request->session()->forget(EnsureStaffSessionIsActive::LAST_ACTIVITY);
        $request->session()->regenerate(destroy: true);
        $request->session()->regenerateToken();

        return response()->noContent();
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->profile($request->user('staff')));
    }

    /** A hash nobody's password matches, made with the configured cost so checking it takes as long as a real one. */
    private static function standInHash(): string
    {
        static $hash = null;

        return $hash ??= Hash::make(Str::random(40));
    }

    /**
     * The term of the day is what the dashboard shows in its term chip, or its "no active term" banner when null.
     *
     * @return array{name: string, email: string, role: string, locale: string, active_term: array{name: string, starts_on: string, ends_on: string}|null}
     */
    private function profile(StaffAccount $account): array
    {
        $term = AcademicTerm::current();

        return [
            ...$account->only(['name', 'email', 'role', 'locale']),
            'active_term' => $term === null ? null : [
                'name' => $term->name,
                'starts_on' => $term->starts_on->toDateString(),
                'ends_on' => $term->ends_on->toDateString(),
            ],
        ];
    }
}
