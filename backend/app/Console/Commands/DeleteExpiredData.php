<?php

namespace App\Console\Commands;

use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\Import;
use App\Models\ImportedMembership;
use App\Models\ManualVisitCount;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Models\User;
use App\Services\UserAccountDeletion;
use App\Services\UserPhotoCleanup;
use Illuminate\Console\Command;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Throwable;

class DeleteExpiredData extends Command
{
    protected $signature = 'data:prune';

    protected $description = 'Delete records whose five-year retention period has ended';

    public function handle(UserAccountDeletion $deletion): int
    {
        $cutoff = now()->subYears(5);

        // Check account activity before pruning visits, so the last Check In is still available.
        User::query()->whereNull('deleted_at')
            ->whereRaw('COALESCE(last_signed_in_at, created_at) <= ?', [$cutoff])
            ->whereNotExists(fn (Builder $query) => $query->selectRaw('1')->from('facility_sessions')
                ->whereColumn('facility_sessions.user_id', 'users.id')->where('started_at', '>', $cutoff))
            ->eachById(fn (User $user) => $deletion->delete($user, $cutoff));

        $photos = DB::transaction(function () use ($cutoff) {
            // The five years count from the last deactivation (E-145, E-150); an active account is never deleted.
            $staff = StaffAccount::query()->whereNotNull('deactivated_at')
                ->where('deactivated_at', '<=', $cutoff)
                ->lockForUpdate()->get();

            FacilitySession::query()->where('created_at', '<=', $cutoff)->delete();
            ManualVisitCount::query()->where('created_at', '<=', $cutoff)->delete();

            // Visits point to authorizations with SET NULL, so they go first.
            $expiredAuthorizations = Authorization::query()->where('created_at', '<=', $cutoff)->lockForUpdate()->get(['id', 'photo_path']);
            $photos = $expiredAuthorizations->pluck('photo_path')->filter()->unique()->values()->all();
            if ($photos !== []) {
                DB::table('pending_photo_deletions')->insert(array_map(fn ($path) => ['path' => $path], $photos));
            }
            Authorization::query()->whereIn('id', $expiredAuthorizations->pluck('id'))->delete();

            // Detach only in this job; ordinary deletes still obey the restrictive foreign keys.
            $imports = Import::query()->where('created_at', '<=', $cutoff)->lockForUpdate()->pluck('id');
            DB::table('imported_memberships')->whereIn('import_id', $imports)->update(['import_id' => null]);
            Import::query()->whereIn('id', $imports)->delete();
            // Orders stay while an authorization still points to them; unclaimed ones go with the period.
            ImportedMembership::query()->where('created_at', '<=', $cutoff)
                ->whereNotExists(fn (Builder $query) => $query->selectRaw('1')->from('authorizations')
                    ->whereColumn('authorizations.imported_membership_id', 'imported_memberships.id'))
                ->delete();
            $roster = RosterRecord::query()->where('removed_at', '<=', $cutoff)->lockForUpdate()->pluck('id');
            DB::table('authorizations')->whereIn('roster_record_id', $roster)->update(['roster_record_id' => null]);
            RosterRecord::query()->whereIn('id', $roster)->delete();
            // Query deletes intentionally bypass the audit model's normal immutability events.
            AuditLogEntry::query()->where('created_at', '<=', $cutoff)->delete();

            foreach ($staff as $account) {
                DB::table('staff_password_reset_tokens')->whereRaw('lower(email) = lower(?)', [$account->email])->delete();
                $account->delete();
            }
            // daily_visit_totals are permanent. Active users keep their waiver, contact and photo.

            return $photos;
        });

        // Files are removed only once their database references have been committed.
        if ($photos !== []) {
            try {
                app(UserPhotoCleanup::class)->deletePending($photos);
            } catch (Throwable $error) {
                // The paths stay queued for the next run.
                report($error);
            }
        }

        return self::SUCCESS;
    }
}
