<?php

namespace Tests\Feature\Auth;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\DailyVisitTotal;
use App\Models\EmailLink;
use App\Models\FacilitySession;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class UserAccountTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private function signedInUser(): User
    {
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa();

        return $user;
    }

    public function test_the_own_account_gets_its_full_email(): void
    {
        $user = $this->signedInUser();
        $user->update(['email' => 'daniel@email.com']);

        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('email', 'daniel@email.com');
        $this->patchJson('/api/user/locale', ['locale' => 'en'])
            ->assertOk()->assertJsonPath('email', 'daniel@email.com');
    }

    public function test_profile_reads_name_and_current_authorization_from_existing_models(): void
    {
        $user = $this->signedInUser();
        WaiverAcceptance::factory()->create(['user_id' => $user->id, 'full_name' => 'María Rodríguez']);
        $term = AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('name', 'María Rodríguez')
            ->assertJsonPath('email', $user->email)
            ->assertJsonPath('authorization.term', $term->name)->assertJsonPath('authorization.type', 'manual');
    }

    public function test_deletion_is_refused_during_an_active_authorization_without_changing_any_data(): void
    {
        Storage::fake('local');
        $user = $this->signedInUser();
        $term = AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);
        $authorization = Authorization::factory()->manual()->create([
            'user_id' => $user->id, 'academic_term_id' => $term->id, 'photo_path' => 'photos/active.jpg',
        ]);
        Storage::disk('local')->put('photos/active.jpg', 'photo');
        $before = $authorization->fresh()->getAttributes();
        $this->deleteJson('/api/user/account')->assertConflict()->assertJsonPath('error.code', 'user_authorization_active');
        $this->assertNull($user->fresh()->deleted_at);
        $this->assertNotNull($user->fresh()->email);
        $this->assertSame($before, $authorization->fresh()->getAttributes());
        $this->assertDatabaseCount('pending_photo_deletions', 0);
        Storage::disk('local')->assertExists('photos/active.jpg');
        $this->getJson('/api/user/me')->assertOk();
    }

    public function test_profile_prefers_the_current_term_over_a_future_authorization_created_first(): void
    {
        $user = $this->signedInUser();
        $next = AcademicTerm::factory()->create([
            'name' => 'Next term', 'starts_on' => today()->addDays(2), 'ends_on' => today()->addDays(30),
        ]);
        $current = AcademicTerm::factory()->create([
            'name' => 'Current term', 'starts_on' => today()->subDay(), 'ends_on' => today()->addDay(),
        ]);
        foreach ([$next, $current] as $term) {
            Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        }

        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('authorization.term', 'Current term');
    }

    public function test_profile_returns_no_authorization_when_only_ended_and_future_terms_exist(): void
    {
        $user = $this->signedInUser();
        foreach ([
            ['Ended term', -30, -1],
            ['Next term', 1, 30],
        ] as [$name, $start, $end]) {
            $term = AcademicTerm::factory()->create([
                'name' => $name, 'starts_on' => today()->addDays($start), 'ends_on' => today()->addDays($end),
            ]);
            Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        }

        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('authorization', null);
    }

    public function test_profile_returns_the_account_type_without_an_active_authorization(): void
    {
        $user = $this->signedInUser();
        foreach ([['Older term', -90, -60, 'paid'], ['Ended term', -30, -1, 'athlete']] as [$name, $start, $end, $type]) {
            $term = AcademicTerm::factory()->create([
                'name' => $name, 'starts_on' => today()->addDays($start), 'ends_on' => today()->addDays($end),
            ]);
            Authorization::factory()->{$type}()->create(['user_id' => $user->id, 'academic_term_id' => $term->id, 'status' => 'revoked']);
        }

        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('authorization', null)->assertJsonPath('account_type', 'athlete');
    }

    public function test_profile_takes_the_account_type_from_the_current_authorization_over_a_later_one(): void
    {
        $user = $this->signedInUser();
        $current = AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);
        $next = AcademicTerm::factory()->create(['starts_on' => today()->addDays(2), 'ends_on' => today()->addDays(30)]);
        Authorization::factory()->paid()->create(['user_id' => $user->id, 'academic_term_id' => $current->id]);
        Authorization::factory()->athlete()->create(['user_id' => $user->id, 'academic_term_id' => $next->id]);

        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('authorization.type', 'paid')->assertJsonPath('account_type', 'paid');
    }

    public function test_profile_has_no_account_type_before_any_authorization(): void
    {
        $this->signedInUser();
        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('account_type', null);
    }

    public function test_profile_does_not_show_a_future_only_authorization(): void
    {
        $user = $this->signedInUser();
        $term = AcademicTerm::factory()->create([
            'starts_on' => today()->addDay(), 'ends_on' => today()->addDays(30),
        ]);
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);

        $this->getJson('/api/user/me')->assertOk()->assertJsonPath('authorization', null);
    }

    public function test_a_future_authorization_is_not_treated_as_expired_for_deletion(): void
    {
        $user = $this->signedInUser();
        $term = AcademicTerm::factory()->create(['starts_on' => today()->addDays(10), 'ends_on' => today()->addDays(30)]);
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        $this->deleteJson('/api/user/account')->assertConflict()->assertJsonPath('error.code', 'user_authorization_active');
        $this->assertNull($user->fresh()->deleted_at);
    }

    public function test_deletion_removes_personal_data_photos_links_and_sessions_but_keeps_counts_and_audit(): void
    {
        Storage::fake('local');
        $user = $this->signedInUser();
        $term = AcademicTerm::factory()->create(['starts_on' => today()->subDays(10), 'ends_on' => today()->subDay()]);
        $authorization = Authorization::factory()->manual()->create([
            'user_id' => $user->id, 'academic_term_id' => $term->id, 'photo_path' => 'photos/user.jpg',
        ]);
        Storage::disk('local')->put('photos/user.jpg', 'photo');
        WaiverAcceptance::factory()->create(['user_id' => $user->id]);
        EmailLink::factory()->athleteLink()->create(['user_id' => $user->id]);
        Password::broker()->createToken($user);
        $visit = FacilitySession::factory()->create(['user_id' => $user->id, 'authorization_id' => $authorization->id]);
        $total = DailyVisitTotal::factory()->create();
        $entry = AuditLogEntry::factory()->create();
        $totalsBefore = $total->fresh()->totals;
        $auditBefore = $entry->fresh()->getAttributes();
        $email = $user->email;
        $this->deleteJson('/api/user/account')->assertNoContent();
        $user->refresh();
        foreach (['email', 'password', 'locale', 'current_session_id', 'remember_token', 'last_signed_in_at'] as $field) {
            $this->assertNull($user->$field, $field);
        }
        $this->assertNotNull($user->deleted_at);
        Storage::disk('local')->assertMissing('photos/user.jpg');
        $this->assertDatabaseMissing('authorizations', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('waiver_acceptances', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('email_links', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $email]);
        $this->assertDatabaseMissing('sign_in_sessions', ['user_id' => $user->id]);
        $this->assertSame($user->id, $visit->fresh()->user_id);
        $this->assertNull($visit->fresh()->authorization_id);
        $this->assertSame($totalsBefore, $total->fresh()->totals);
        $this->assertSame($auditBefore, $entry->fresh()->getAttributes());
        $this->assertGuest('web');
    }

    public function test_revoked_authorizations_do_not_block_deletion(): void
    {
        $user = $this->signedInUser();
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'status' => 'revoked', 'photo_path' => null]);
        $this->deleteJson('/api/user/account')->assertNoContent();
    }

    public function test_failed_photo_cleanup_returns_success_and_the_scheduler_retries_without_a_queue(): void
    {
        config(['queue.default' => 'sync']);
        Storage::fake('local');
        $files = Storage::disk('local');
        $files->put('photos/retry.jpg', 'photo');
        $user = $this->signedInUser();
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'status' => 'revoked', 'photo_path' => 'photos/retry.jpg']);
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('delete')->once()->with('photos/retry.jpg')->andReturn(false);
        $disk->shouldReceive('delete')->once()->with('photos/retry.jpg')->andReturnUsing(fn ($path) => $files->delete($path));
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);
        $this->deleteJson('/api/user/account')->assertNoContent();
        $this->assertNotNull($user->fresh()->deleted_at);
        $this->assertGuest('web');
        $this->assertDatabaseHas('pending_photo_deletions', ['path' => 'photos/retry.jpg']);
        $files->assertExists('photos/retry.jpg');
        $this->artisan('schedule:run')->assertSuccessful();
        $files->assertMissing('photos/retry.jpg');
        $this->assertDatabaseCount('pending_photo_deletions', 0);
    }

    public function test_user_can_change_only_their_own_locale(): void
    {
        $user = $this->signedInUser();
        $other = User::factory()->create();
        $this->patchJson('/api/user/locale', ['locale' => 'en', 'user_id' => $other->id])->assertOk()->assertJsonPath('locale', 'en');
        $this->assertSame('en', $user->fresh()->locale);
        $this->assertSame('es', $other->fresh()->locale);
        $this->patchJson('/api/user/locale', ['locale' => 'fr'])->assertUnprocessable();
    }

    public function test_deletion_does_not_delete_another_users_photos_or_account(): void
    {
        Storage::fake('local');
        $user = $this->signedInUser();
        $other = User::factory()->create();
        Authorization::factory()->manual()->create(['user_id' => $other->id, 'photo_path' => 'photos/other.jpg']);
        Storage::disk('local')->put('photos/other.jpg', 'other');
        $this->deleteJson('/api/user/account', ['user_id' => $other->id])->assertNoContent();
        $this->assertNotNull($user->fresh()->deleted_at);
        $this->assertNull($other->fresh()->deleted_at);
        Storage::disk('local')->assertExists('photos/other.jpg');
        $this->assertSame(1, DB::table('authorizations')->where('user_id', $other->id)->count());
    }
}
