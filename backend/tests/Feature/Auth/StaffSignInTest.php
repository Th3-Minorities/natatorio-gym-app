<?php

namespace Tests\Feature\Auth;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** Staff sign in on N-11 with their own account (REQ-F-52, REQ-F-88), and it is logged (REQ-NF-39, E-108). */
class StaffSignInTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    public function test_a_staff_account_signs_in_with_email_and_password(): void
    {
        $staff = StaffAccount::factory()->create(['name' => 'Luis Ortiz', 'email' => 'luis@example.com', 'locale' => 'en']);

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'luis@example.com', 'password' => 'password'])
            ->assertOk()
            ->assertExactJson(['name' => 'Luis Ortiz', 'email' => 'luis@example.com', 'role' => 'staff', 'locale' => 'en', 'active_term' => null]);

        $this->assertAuthenticatedAs($staff, 'staff');
    }

    public function test_the_sign_in_is_written_to_the_audit_log(): void
    {
        $staff = StaffAccount::factory()->create(['email' => 'luis@example.com']);

        $this->fromThePwa()
            ->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->postJson('/api/staff/sign-in', ['email' => 'luis@example.com', 'password' => 'password']);

        $entry = AuditLogEntry::query()->sole();
        $this->assertSame('staff.sign_in', $entry->action);
        $this->assertSame($staff->id, $entry->staff_account_id);
        $this->assertSame('203.0.113.7', $entry->ip_address);
    }

    public function test_the_email_is_matched_whatever_its_case(): void
    {
        StaffAccount::factory()->create(['email' => 'Luis@Example.com']);

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'luis@example.COM', 'password' => 'password'])
            ->assertOk();
    }

    public function test_the_session_id_changes_at_sign_in(): void
    {
        // A session id someone planted before the sign-in must not become a signed-in session.
        StaffAccount::factory()->create(['email' => 'luis@example.com']);
        $this->fromThePwa()->get('/api/sanctum/csrf-cookie');
        $before = session()->getId();

        $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => 'luis@example.com', 'password' => 'password']);

        $this->assertNotSame($before, session()->getId());
    }

    public function test_a_wrong_password_is_refused_and_not_logged(): void
    {
        StaffAccount::factory()->create(['email' => 'luis@example.com']);

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'luis@example.com', 'password' => 'wrong-password'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'staff_credentials_invalid');

        $this->assertGuest('staff');
        $this->assertSame(0, AuditLogEntry::query()->count());
    }

    public function test_an_unknown_email_gets_the_same_answer_as_a_wrong_password(): void
    {
        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'nobody@example.com', 'password' => 'password'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'staff_credentials_invalid');
    }

    public function test_an_unknown_email_costs_the_same_password_check_as_a_real_one(): void
    {
        // Otherwise an unknown email answers faster, and the time tells which emails are staff accounts.
        Hash::spy();

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'nobody@example.com', 'password' => 'password'])
            ->assertJsonPath('error.code', 'staff_credentials_invalid');

        Hash::shouldHaveReceived('check')->once();
    }

    public function test_an_invited_account_costs_the_same_password_check_as_a_real_one(): void
    {
        StaffAccount::factory()->create(['email' => 'new@example.com', 'password' => null]);
        Hash::spy();

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'new@example.com', 'password' => 'anything'])
            ->assertJsonPath('error.code', 'staff_credentials_invalid');

        Hash::shouldHaveReceived('check')->once();
    }

    public function test_an_invited_account_without_a_password_cannot_sign_in(): void
    {
        StaffAccount::factory()->create(['email' => 'new@example.com', 'password' => null]);

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'new@example.com', 'password' => ''])
            ->assertStatus(422);
        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'new@example.com', 'password' => 'anything'])
            ->assertJsonPath('error.code', 'staff_credentials_invalid');

        $this->assertGuest('staff');
    }

    public function test_a_deactivated_account_is_refused_with_its_own_code_after_the_right_password(): void
    {
        StaffAccount::factory()->deactivated()->create(['email' => 'gone@example.com']);

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'gone@example.com', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'staff_account_deactivated');

        $this->assertGuest('staff');
    }

    public function test_a_deactivated_account_with_a_wrong_password_looks_like_any_wrong_password(): void
    {
        // Otherwise anyone could find out which emails belong to people who left.
        StaffAccount::factory()->deactivated()->create(['email' => 'gone@example.com']);

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'gone@example.com', 'password' => 'wrong-password'])
            ->assertJsonPath('error.code', 'staff_credentials_invalid');
    }

    public function test_missing_fields_are_refused_by_the_server(): void
    {
        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', [])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'validation_failed')
            ->assertJsonStructure(['error' => ['details' => ['email', 'password']]]);
    }

    public function test_a_user_account_cannot_sign_in_on_the_staff_page(): void
    {
        User::factory()->create(['email' => 'student@example.com']);

        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => 'student@example.com', 'password' => 'password'])
            ->assertJsonPath('error.code', 'staff_credentials_invalid');
    }

    public function test_who_am_i_answers_for_the_signed_in_staff_account(): void
    {
        $admin = StaffAccount::factory()->admin()->create(['name' => 'Ana Rivera', 'email' => 'ana@example.com']);

        $this->actingAs($admin, 'staff')
            ->fromThePwa()
            ->getJson('/api/staff/me')
            ->assertOk()
            ->assertExactJson(['name' => 'Ana Rivera', 'email' => 'ana@example.com', 'role' => 'admin', 'locale' => 'es', 'active_term' => null]);
    }

    public function test_who_am_i_needs_a_staff_sign_in(): void
    {
        $this->fromThePwa()->getJson('/api/staff/me')
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'unauthenticated');

        $this->actingAs(User::factory()->create(), 'web')
            ->fromThePwa()
            ->getJson('/api/staff/me')
            ->assertUnauthorized();
    }

    public function test_the_session_answers_carry_the_term_that_includes_today(): void
    {
        AcademicTerm::factory()->create(['name' => 'Spring', 'starts_on' => today()->subMonths(5), 'ends_on' => today()->subMonths(2)]);
        AcademicTerm::factory()->create(['name' => 'Fall', 'starts_on' => today()->subMonth(), 'ends_on' => today()]);
        AcademicTerm::factory()->create(['name' => 'Next', 'starts_on' => today()->addDay(), 'ends_on' => today()->addMonths(4)]);
        $staff = StaffAccount::factory()->create(['email' => 'luis@example.com']);
        $term = ['name' => 'Fall', 'starts_on' => today()->subMonth()->toDateString(), 'ends_on' => today()->toDateString()];

        $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => 'luis@example.com', 'password' => 'password'])
            ->assertOk()->assertJsonPath('active_term', $term);
        $this->actingAs($staff, 'staff')->fromThePwa()->getJson('/api/staff/me')
            ->assertOk()->assertJsonPath('active_term', $term);
    }

    public function test_the_term_is_null_when_none_includes_today(): void
    {
        AcademicTerm::factory()->create(['starts_on' => today()->subMonths(5), 'ends_on' => today()->subDay()]);
        AcademicTerm::factory()->create(['starts_on' => today()->addDay(), 'ends_on' => today()->addMonths(4)]);

        $this->actingAs(StaffAccount::factory()->admin()->create(), 'staff')->fromThePwa()->getJson('/api/staff/me')
            ->assertOk()->assertJsonPath('active_term', null);
    }

    public function test_the_term_ends_at_midnight_in_puerto_rico_not_in_utc(): void
    {
        AcademicTerm::factory()->create(['name' => 'Fall', 'starts_on' => '2026-08-17', 'ends_on' => '2026-12-11']);
        $admin = StaffAccount::factory()->admin()->create();
        // A sign-in from before the time travel would be idle for too long, so each moment starts a new one.
        $meAt = function (string $utc) use ($admin) {
            $this->travelTo(Carbon::parse($utc, 'UTC'));
            $this->flushSession();

            return $this->actingAs($admin, 'staff')->fromThePwa()->getJson('/api/staff/me')->assertOk();
        };

        // 02:00 UTC on 12 Dec is 10:00 PM on 11 Dec in Puerto Rico (UTC-4, no daylight saving): still the last day.
        $meAt('2026-12-12 02:00:00')->assertJsonPath('active_term.name', 'Fall');
        // 04:00 UTC is midnight in Puerto Rico: the term is over.
        $meAt('2026-12-12 04:00:00')->assertJsonPath('active_term', null);
    }

    public function test_the_term_is_not_shown_without_a_staff_sign_in(): void
    {
        AcademicTerm::factory()->create(['starts_on' => today()->subMonth(), 'ends_on' => today()->addMonth()]);

        $this->fromThePwa()->getJson('/api/staff/me')->assertUnauthorized()->assertJsonMissingPath('active_term');
        $this->actingAs(User::factory()->create(), 'web')->fromThePwa()->getJson('/api/staff/me')
            ->assertUnauthorized()->assertJsonMissingPath('active_term');
    }

    public function test_sign_out_ends_the_staff_sign_in_and_is_logged(): void
    {
        $staff = StaffAccount::factory()->create(['email' => 'luis@example.com']);
        $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => 'luis@example.com', 'password' => 'password']);

        $this->fromThePwa()->postJson('/api/staff/sign-out')->assertNoContent();

        $this->assertGuest('staff');
        $this->fromThePwa()->getJson('/api/staff/me')->assertUnauthorized();
        $entry = AuditLogEntry::query()->where('action', 'staff.sign_out')->sole();
        $this->assertSame($staff->id, $entry->staff_account_id);
    }

    public function test_sign_out_needs_a_staff_sign_in(): void
    {
        $this->fromThePwa()->postJson('/api/staff/sign-out')->assertUnauthorized();
    }
}
