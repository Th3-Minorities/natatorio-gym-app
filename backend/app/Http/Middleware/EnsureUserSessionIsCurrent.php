<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserSessionIsCurrent
{
    public function handle(Request $request, Closure $next): Response
    {
        $guard = Auth::guard('web');
        $user = $guard->user();

        if (! $user instanceof User) {
            if ($request->hasCookie($guard->getRecallerName())) {
                throw new ApiException('user_session_replaced', 401);
            }
            throw new ApiException('unauthenticated', 401);
        }

        // Re-read the row: a second device or a password reset may have revoked this session.
        $user->refresh();
        if ($user->deleted_at !== null || $user->current_session_id === null) {
            throw new ApiException('user_session_replaced', 401);
        }

        // Laravel has checked this device's rotated remember token before resuming its short session.
        if ($guard->viaRemember()) {
            $request->session()->put('user_session_id', $user->current_session_id);
        }

        if (! hash_equals($user->current_session_id, (string) $request->session()->get('user_session_id'))) {
            // logoutCurrentDevice leaves the winning device's remember token intact.
            $guard->logoutCurrentDevice();
            throw new ApiException('user_session_replaced', 401);
        }

        return $next($request);
    }
}
