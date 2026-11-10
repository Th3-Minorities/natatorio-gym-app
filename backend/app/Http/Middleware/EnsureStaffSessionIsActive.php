<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\StaffAccount;
use App\Services\AuditLog;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Runs after auth:staff on every staff route (E-130):
 * - a deactivated account is signed out at once;
 * - a sign-in ends after 2 hours (Staff) or 20 minutes (Administrator) without a person
 *   tapping or typing. Requests with the X-Auto-Refresh header are the screen refreshing
 *   itself, so they do not count as activity.
 */
class EnsureStaffSessionIsActive
{
    public const LAST_ACTIVITY = 'staff_last_activity_at';

    public const AUTO_REFRESH_HEADER = 'X-Auto-Refresh';

    public const PASSWORD_FINGERPRINT = 'staff_password_fingerprint';

    private const IDLE_LIMITS = ['staff' => 2 * 60 * 60, 'admin' => 20 * 60];

    public function __construct(private AuditLog $log) {}

    public function handle(Request $request, Closure $next): Response
    {
        /** @var StaffAccount $account */
        $account = $request->user('staff');
        $session = $request->session();
        $now = now()->getTimestamp();

        if ($account->deactivated_at !== null) {
            // The deactivation itself is logged by the Administrator's action (#84).
            $this->signOut($request);

            throw new ApiException('staff_account_deactivated', 401);
        }

        // The password changed since this sign-in, for example by a reset: it ends with no message.
        $fingerprint = $session->get(self::PASSWORD_FINGERPRINT);
        if ($fingerprint === null) {
            $session->put(self::PASSWORD_FINGERPRINT, $account->passwordFingerprint());
        } elseif (! hash_equals($account->passwordFingerprint(), (string) $fingerprint)) {
            $this->signOut($request);

            throw new ApiException('unauthenticated', 401);
        }

        $lastActivity = (int) $session->get(self::LAST_ACTIVITY, $now);

        if ($now - $lastActivity >= self::IDLE_LIMITS[$account->role]) {
            $this->log->record('staff.sign_out', $account, after: ['ended_by' => 'timeout'], by: $account);
            $this->signOut($request);

            throw new ApiException('staff_session_expired', 401);
        }

        if (! $request->hasHeader(self::AUTO_REFRESH_HEADER)) {
            $session->put(self::LAST_ACTIVITY, $now);
        }

        return $next($request);
    }

    private function signOut(Request $request): void
    {
        Auth::guard('staff')->logout();
        $request->session()->forget([self::LAST_ACTIVITY, self::PASSWORD_FINGERPRINT]);
        $request->session()->regenerate(destroy: true);
        $request->session()->regenerateToken();
    }
}
