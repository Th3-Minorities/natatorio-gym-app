<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\FacilitySession;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Throwable;

class UserAccountDeletion
{
    public function delete(User $user, ?CarbonInterface $inactiveSince = null): void
    {
        $photos = DB::transaction(function () use ($user, $inactiveSince) {
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($user->deleted_at !== null) {
                return [];
            }
            // Recheck after taking the same user lock as sign-in, before anonymizing the account.
            if ($inactiveSince !== null && (
                ($user->last_signed_in_at ?? $user->created_at)->gt($inactiveSince)
                || FacilitySession::query()->where('user_id', $user->id)->where('started_at', '>', $inactiveSince)->exists()
            )) {
                return [];
            }
            $authorizations = Authorization::query()->where('user_id', $user->id)->lockForUpdate()->get();
            if ($inactiveSince === null && $user->activeAuthorizations()->exists()) {
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
    }
}
