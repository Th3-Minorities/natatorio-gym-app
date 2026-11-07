<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Services\UserSessions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;

class UserPasswordController extends Controller
{
    public function email(Request $request): JsonResponse
    {
        $input = $request->validate(['email' => ['required', 'string', 'email', 'max:255']]);
        dispatch(function () use ($input) {
            $user = $this->account($input['email']);
            if ($user !== null) {
                Password::broker()->sendResetLink(['email' => $user->email]);
            }
        })->afterResponse();

        // Includes broker throttling: neither the answer nor a status reveals an account.
        return response()->json(['status' => 'received']);
    }

    public function validateLink(Request $request): Response
    {
        $input = $request->validate($this->linkRules());
        $user = $this->account($input['email']);
        if ($user === null || ! Password::broker()->tokenExists($user, $input['token'])) {
            throw new ApiException('user_reset_link_invalid', 422);
        }

        return response()->noContent();
    }

    public function reset(Request $request): Response
    {
        $input = $request->validate([
            ...$this->linkRules(),
            'password' => ['required', 'string', 'max:255', 'confirmed', PasswordRule::min(10)->uncompromised()],
            'password_confirmation' => ['required', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($input) {
            $user = $this->account($input['email'], lock: true);
            if ($user === null) {
                throw new ApiException('user_reset_link_invalid', 422);
            }
            $status = Password::broker()->reset([...$input, 'email' => $user->email], function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'current_session_id' => null, 'remember_token' => Str::random(60)])->save();
                app(UserSessions::class)->revoke($user);
            });
            if ($status !== Password::PasswordReset) {
                throw new ApiException('user_reset_link_invalid', 422);
            }
        });

        return response()->noContent();
    }

    private function linkRules(): array
    {
        return ['email' => ['required', 'string', 'email', 'max:255'], 'token' => ['required', 'string', 'max:255']];
    }

    private function account(string $email, bool $lock = false): ?User
    {
        $query = User::query()->whereRaw('lower(email) = lower(?)', [$email])->whereNull('deleted_at');

        return ($lock ? $query->lockForUpdate() : $query)->first();
    }
}
