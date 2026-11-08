<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\User;
use App\Models\WaiverAcceptance;
use App\Services\UserPhotoCleanup;
use App\Services\UserSessions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class UserAccountController extends Controller
{
    public function me(Request $request): JsonResponse
    {
        $user = $request->user('web');

        return response()->json($user->profile());
    }

    public function photo(Request $request): StreamedResponse
    {
        $path = Authorization::query()->where('user_id', $request->user('web')->id)
            ->orderByDesc('id')->value('photo_path');
        if (! $path || ! Storage::disk('local')->exists($path)) {
            throw new ApiException('not_found', 404);
        }

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store']);
    }

    public function locale(Request $request): JsonResponse
    {
        $input = $request->validate(['locale' => ['required', 'string', 'in:es,en']]);
        $request->user('web')->update($input);

        return $this->me($request);
    }

    public function delete(Request $request): Response
    {
        $photos = DB::transaction(function () use ($request) {
            $user = User::query()->lockForUpdate()->findOrFail($request->user('web')->id);
            $authorizations = Authorization::query()->where('user_id', $user->id)->lockForUpdate()->get();
            if ($user->activeAuthorizations()->exists()) {
                throw new ApiException('user_authorization_active', 409);
            }
            $photos = $authorizations->pluck('photo_path')->filter()->unique()->values()->all();
            if ($photos !== []) {
                DB::table('pending_photo_deletions')->insert(array_map(fn ($path) => ['path' => $path], $photos));
            }
            Authorization::query()->where('user_id', $user->id)->delete();
            WaiverAcceptance::query()->where('user_id', $user->id)->delete();
            EmailLink::query()->where('user_id', $user->id)->delete();
            DB::table('password_reset_tokens')->whereRaw('lower(email) = lower(?)', [$user->email])->delete();
            app(UserSessions::class)->revoke($user);
            $user->forceFill([
                'email' => null, 'password' => null, 'locale' => null, 'current_session_id' => null,
                'remember_token' => null, 'last_signed_in_at' => null, 'deleted_at' => now(),
            ])->save();

            return $photos;
        });

        // Files are removed only once their database references have been committed.
        if ($photos !== []) {
            try {
                app(UserPhotoCleanup::class)->deletePending($photos);
            } catch (Throwable $error) {
                // The deletion is committed; the scheduler still has the paths.
                report($error);
            }
        }
        Auth::guard('web')->logoutCurrentDevice();
        $request->session()->forget('user_session_id');
        $request->session()->regenerate(destroy: true);
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
