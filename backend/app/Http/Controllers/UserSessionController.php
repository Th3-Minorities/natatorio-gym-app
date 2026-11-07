<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Services\SignInThrottle;
use App\Services\UserSessions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSessionController extends Controller
{
    public function signIn(Request $request, UserSessions $sessions): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string', 'max:255'],
        ]);
        $throttle = new SignInThrottle('user-sign-in');
        $throttle->ensureNotLocked($credentials['email'], $request->ip());

        $user = DB::transaction(function () use ($credentials, $request, $throttle, $sessions) {
            $user = User::query()->whereRaw('lower(email) = lower(?)', [$credentials['email']])->lockForUpdate()->first();
            // A dummy hash keeps unknown accounts on the password hashing path too.
            $hash = $user?->password ?? sprintf('$2y$%02d$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.', config('hashing.bcrypt.rounds'));
            if (! Hash::check($credentials['password'], $hash) || $user === null || $user->deleted_at !== null) {
                return null;
            }

            $throttle->clearAccount($credentials['email']);
            // Each login rotates the persistent credential, so an older device cannot resume later.
            $user->forceFill(['remember_token' => Str::random(60)])->save();
            Auth::guard('web')->login($user, remember: true);
            $request->session()->regenerate();
            $user->forceFill(['current_session_id' => $request->session()->getId(), 'last_signed_in_at' => now()])->save();
            $request->session()->put('user_session_id', $user->current_session_id);
            $sessions->revoke($user, $request->session()->getId());

            return $user;
        });

        // Database-backed cache counters must survive the failed sign-in transaction.
        if ($user === null) {
            $throttle->recordFailure($credentials['email'], $request->ip());
            throw new ApiException('user_credentials_invalid', 422);
        }

        return response()->json($user->profile());
    }

    public function signOut(Request $request): Response
    {
        $user = $request->user('web');
        DB::transaction(function () use ($user) {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            // An old request finishing after another login must not revoke the new device.
            if ($locked->current_session_id === session('user_session_id')) {
                $locked->forceFill(['current_session_id' => null, 'remember_token' => null])->save();
            }
        });
        Auth::guard('web')->logoutCurrentDevice();
        $request->session()->forget('user_session_id');
        $request->session()->regenerate(destroy: true);
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
