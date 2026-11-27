<?php

namespace Tests\Feature\Console;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\DailyVisitTotal;
use App\Models\EmailLink;
use App\Models\FacilitySession;
use App\Models\Import;
use App\Models\ImportedMembership;
use App\Models\ManualVisitCount;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class DataRetentionTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2032-11-27 12:00:00', config('app.timezone')));
        Storage::fake('local');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_inactive_users_use_the_latest_sign_in_or_check_in_and_reuse_account_anonymization(): void
    {
        $cutoff = now()->subYears(5);
        $expired = User::factory()->create(['created_at' => $cutoff->copy()->subYear(), 'last_signed_in_at' => $cutoff]);
        $authorization = Authorization::factory()->manual()->create([
            'user_id' => $expired->id, 'photo_path' => 'photos/expired.jpg',
        ]);
        Storage::disk('local')->put('photos/expired.jpg', 'photo');
        WaiverAcceptance::factory()->create(['user_id' => $expired->id]);
        EmailLink::factory()->athleteLink()->create(['user_id' => $expired->id]);
        Password::broker()->createToken($expired);
        DB::table('sign_in_sessions')->insert([
            'id' => 'expired-device', 'user_id' => $expired->id,
            'payload' => base64_encode('{}'), 'last_activity' => now()->timestamp,
        ]);
        $lastVisit = $this->visit($expired, $cutoff, now(), $authorization->id);
        $recentSignIn = User::factory()->create(['last_signed_in_at' => $cutoff->copy()->addSecond()]);
        $recentCheckIn = User::factory()->create(['last_signed_in_at' => $cutoff->copy()->subDay()]);
        $this->visit($recentCheckIn, $cutoff->copy()->addSecond(), now());
        $neverSignedIn = User::factory()->create(['created_at' => $cutoff]);
        $newAccount = User::factory()->create(['created_at' => $cutoff->copy()->addSecond()]);
        $alreadyDeleted = User::factory()->create([
            'email' => null, 'password' => null, 'locale' => null,
            'created_at' => $cutoff, 'deleted_at' => $cutoff,
        ]);

        $this->artisan('data:prune')->assertSuccessful();

        foreach (['email', 'password', 'locale', 'current_session_id', 'remember_token', 'last_signed_in_at'] as $field) {
            $this->assertNull($expired->fresh()->$field, $field);
        }
        $this->assertNotNull($expired->fresh()->deleted_at);
        $this->assertNotNull($neverSignedIn->fresh()->deleted_at);
        $this->assertNull($recentSignIn->fresh()->deleted_at);
        $this->assertNull($recentCheckIn->fresh()->deleted_at);
        $this->assertNull($newAccount->fresh()->deleted_at);
        $this->assertTrue($alreadyDeleted->fresh()->deleted_at->equalTo($cutoff));
        foreach (['authorizations', 'waiver_acceptances', 'email_links', 'sign_in_sessions'] as $table) {
            $this->assertDatabaseMissing($table, ['user_id' => $expired->id]);
        }
        $this->assertDatabaseCount('password_reset_tokens', 0);
        Storage::disk('local')->assertMissing('photos/expired.jpg');
        $this->assertNull($lastVisit->fresh()->authorization_id);

        $deletedAt = $expired->fresh()->deleted_at;
        $this->artisan('data:prune')->assertSuccessful();
        $this->assertTrue($expired->fresh()->deleted_at->equalTo($deletedAt));
    }

    public function test_active_accounts_lose_only_expired_records_and_keep_current_personal_data_and_daily_totals(): void
    {
        $cutoff = now()->subYears(5);
        $user = User::factory()->create(['last_signed_in_at' => now()]);
        $authorization = Authorization::factory()->manual()->create([
            'user_id' => $user->id, 'photo_path' => 'photos/current.jpg', 'created_at' => $cutoff->copy()->addSecond(),
        ]);
        $waiver = WaiverAcceptance::factory()->create(['user_id' => $user->id, 'created_at' => $cutoff->copy()->subDay()]);
        Storage::disk('local')->put('photos/current.jpg', 'photo');
        $waiverBefore = $waiver->fresh()->getAttributes();
        // Creation, rather than the paper visit's start, controls record retention.
        $oldVisit = $this->visit($user, $cutoff->copy()->subDay(), $cutoff, $authorization->id);
        $recentVisit = $this->visit($user, $cutoff->copy()->subDays(2), $cutoff->copy()->addSecond(), $authorization->id);
        $oldImport = Import::factory()->create(['created_at' => $cutoff]);
        $recentImport = Import::factory()->create(['created_at' => $cutoff->copy()->addSecond()]);
        $membership = ImportedMembership::factory()->create(['import_id' => $oldImport->id]);
        $oldAudit = AuditLogEntry::factory()->create(['created_at' => $cutoff, 'occurred_at' => $cutoff]);
        $recentAudit = AuditLogEntry::factory()->create(['created_at' => $cutoff->copy()->addSecond(), 'occurred_at' => $cutoff]);
        $oldManual = ManualVisitCount::factory()->create(['created_at' => $cutoff]);
        $recentManual = ManualVisitCount::factory()->create(['created_at' => $cutoff->copy()->addSecond()]);
        $total = DailyVisitTotal::factory()->create(['day' => '2020-01-01', 'created_at' => '2020-01-01']);
        $totalsBefore = $total->fresh()->getAttributes();

        $this->artisan('data:prune')->assertSuccessful();

        $this->assertModelMissing($oldVisit);
        $this->assertModelExists($recentVisit);
        $this->assertModelMissing($oldImport);
        $this->assertModelExists($recentImport);
        $this->assertNull($membership->fresh()->import_id);
        $this->assertModelMissing($oldAudit);
        $this->assertModelExists($recentAudit);
        $this->assertModelMissing($oldManual);
        $this->assertModelExists($recentManual);
        $this->assertSame($waiverBefore, $waiver->fresh()->getAttributes());
        $this->assertSame($totalsBefore, $total->fresh()->getAttributes());
        $this->assertNull($user->fresh()->deleted_at);
        $this->assertSame('photos/current.jpg', $authorization->fresh()->photo_path);
        Storage::disk('local')->assertExists('photos/current.jpg');
    }

    public function test_roster_retention_starts_at_removal_and_preserves_the_active_users_photo(): void
    {
        $cutoff = now()->subYears(5);
        $expired = RosterRecord::factory()->create(['removed_at' => $cutoff]);
        $recent = RosterRecord::factory()->create(['removed_at' => $cutoff->copy()->addSecond(), 'created_at' => $cutoff->copy()->subYear()]);
        $active = RosterRecord::factory()->create(['created_at' => $cutoff->copy()->subYear()]);
        $authorization = Authorization::factory()->athlete($expired)->create([
            'status' => 'revoked', 'photo_path' => 'photos/athlete.jpg',
        ]);
        Storage::disk('local')->put('photos/athlete.jpg', 'photo');
        // Withdrawal leaves past-term authorizations active; they must not block the roster deletion.
        $pastTerm = Authorization::factory()->athlete($expired)->create([
            'status' => 'active', 'academic_term_id' => AcademicTerm::factory()->create()->id,
        ]);
        $link = EmailLink::factory()->create(['roster_record_id' => $expired->id]);

        $this->artisan('data:prune')->assertSuccessful();

        $this->assertModelMissing($expired);
        $this->assertModelExists($recent);
        $this->assertModelExists($active);
        $this->assertModelMissing($link);
        $this->assertNull($authorization->fresh()->roster_record_id);
        $this->assertNull($pastTerm->fresh()->roster_record_id);
        Storage::disk('local')->assertExists('photos/athlete.jpg');
        $user = $authorization->user;
        $user->update(['current_session_id' => 'athlete-device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'athlete-device'])->fromThePwa();
        $this->getJson('/api/user/check-in')->assertOk()->assertJsonPath('sport', null);
    }

    public function test_a_deactivated_staff_account_is_deleted_five_years_after_its_last_deactivation(): void
    {
        $cutoff = now()->subYears(5);
        $expired = StaffAccount::factory()->create(['deactivated_at' => $cutoff]);
        $recent = StaffAccount::factory()->create(['deactivated_at' => $cutoff->copy()->addSecond()]);
        $active = StaffAccount::factory()->create(['created_at' => $cutoff->copy()->subYear()]);
        $link = EmailLink::factory()->staffInvite()->create(['staff_account_id' => $expired->id]);
        DB::table('staff_password_reset_tokens')->insert(['email' => $expired->email, 'token' => 'hash']);

        $this->artisan('data:prune')->assertSuccessful();

        $this->assertModelMissing($expired);
        $this->assertModelExists($recent);
        $this->assertModelExists($active);
        $this->assertModelMissing($link);
        $this->assertDatabaseMissing('staff_password_reset_tokens', ['email' => $expired->email]);
    }

    public function test_deleting_a_staff_account_after_its_history_is_pruned_leaves_no_blocking_links(): void
    {
        $cutoff = now()->subYears(5);
        $staff = StaffAccount::factory()->create(['deactivated_at' => $cutoff]);
        $visit = FacilitySession::factory()->checkedOut()->create([
            'entered_by_staff_account_id' => $staff->id, 'checked_out_by_staff_account_id' => $staff->id,
            'created_at' => $cutoff,
        ]);
        $count = ManualVisitCount::factory()->create(['entered_by_staff_account_id' => $staff->id, 'created_at' => $cutoff]);
        $entry = AuditLogEntry::factory()->create(['staff_account_id' => $staff->id, 'created_at' => $cutoff, 'occurred_at' => $cutoff]);

        $this->artisan('data:prune')->assertSuccessful();

        $this->assertModelMissing($staff);
        $this->assertModelMissing($visit);
        $this->assertModelMissing($count);
        $this->assertModelMissing($entry);
    }

    public function test_reactivating_a_staff_account_restarts_the_five_years_at_the_next_deactivation(): void
    {
        $cutoff = now()->subYears(5);
        $staff = StaffAccount::factory()->create(['deactivated_at' => $cutoff->copy()->subYear()]);
        $staff->update(['deactivated_at' => null]);

        $this->artisan('data:prune')->assertSuccessful();
        $this->assertModelExists($staff);

        $staff->update(['deactivated_at' => now()]);
        $this->artisan('data:prune')->assertSuccessful();
        $this->assertModelExists($staff);
    }

    public function test_authorizations_are_deleted_five_years_after_creation_even_for_active_accounts(): void
    {
        $cutoff = now()->subYears(5);
        $user = User::factory()->create(['last_signed_in_at' => now()]);
        $membership = ImportedMembership::factory()->create(['created_at' => $cutoff]);
        $expired = Authorization::factory()->paid($membership)->create([
            'user_id' => $user->id, 'photo_path' => 'photos/old.jpg', 'created_at' => $cutoff,
        ]);
        $recent = Authorization::factory()->manual()->create([
            'user_id' => $user->id, 'photo_path' => 'photos/new.jpg', 'created_at' => $cutoff->copy()->addSecond(),
            'academic_term_id' => AcademicTerm::factory()->create()->id,
        ]);
        Storage::disk('local')->put('photos/old.jpg', 'photo');
        Storage::disk('local')->put('photos/new.jpg', 'photo');
        $visit = $this->visit($user, now()->subDay(), now(), $expired->id);

        $this->artisan('data:prune')->assertSuccessful();

        $this->assertModelMissing($expired);
        $this->assertModelExists($recent);
        $this->assertNull($visit->fresh()->authorization_id);
        $this->assertNull($user->fresh()->deleted_at);
        Storage::disk('local')->assertMissing('photos/old.jpg');
        Storage::disk('local')->assertExists('photos/new.jpg');
        $this->assertDatabaseCount('pending_photo_deletions', 0);
        // The order is no longer referenced once the authorization is gone.
        $this->assertModelMissing($membership);
    }

    public function test_orders_are_deleted_five_years_after_creation_unless_a_current_authorization_uses_them(): void
    {
        $cutoff = now()->subYears(5);
        $unclaimed = ImportedMembership::factory()->create(['created_at' => $cutoff]);
        $inside = ImportedMembership::factory()->create(['created_at' => $cutoff->copy()->addSecond()]);
        $claimed = ImportedMembership::factory()->create(['created_at' => $cutoff]);
        $authorization = Authorization::factory()->paid($claimed)->create(['created_at' => $cutoff->copy()->addSecond()]);

        $this->artisan('data:prune')->assertSuccessful();

        $this->assertModelMissing($unclaimed);
        $this->assertModelExists($inside);
        $this->assertModelExists($claimed);
        $this->assertModelExists($authorization);
    }

    public function test_the_command_is_scheduled_daily_without_overlapping(): void
    {
        $event = collect(app(Schedule::class)->events())->sole(fn ($event) => str_contains($event->command ?? '', 'data:prune'));

        $this->assertSame('0 0 * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
    }

    private function visit(User $user, Carbon $startedAt, Carbon $createdAt, ?int $authorizationId = null): FacilitySession
    {
        return FacilitySession::factory()->create([
            'user_id' => $user->id, 'authorization_id' => $authorizationId, 'status' => 'expired',
            'started_at' => $startedAt, 'ends_at' => $startedAt->copy()->addHours(2), 'created_at' => $createdAt,
        ]);
    }
}
