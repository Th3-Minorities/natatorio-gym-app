<?php

namespace Tests\Feature\Database;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\AssertsDatabaseRules;
use Tests\TestCase;

/** Rules for users, staff_accounts, sign_in_sessions and audit_log_entries (data-model.md sections 2, 4, 5 and 6). */
class AccountsAndAuditTablesTest extends TestCase
{
    use AssertsDatabaseRules, RefreshDatabase;

    public function test_two_users_cannot_share_an_email_whatever_its_case(): void
    {
        User::factory()->create(['email' => 'Ana@Example.com']);

        $this->assertRejected('23505', fn () => User::factory()->create(['email' => 'ana@example.com']));
    }

    public function test_deleted_users_have_no_email_so_they_never_collide(): void
    {
        User::factory()->count(2)->create(['email' => null, 'password' => null, 'locale' => null, 'deleted_at' => now()]);

        $this->assertSame(2, User::query()->whereNull('email')->count());
    }

    public function test_a_user_language_is_spanish_or_english(): void
    {
        User::factory()->create(['locale' => 'es']);
        User::factory()->create(['locale' => 'en']);

        $this->assertRejected('23514', fn () => User::factory()->create(['locale' => 'fr']));
    }

    public function test_a_user_keeps_only_the_columns_the_design_lists(): void
    {
        $this->assertSame(
            ['id', 'email', 'password', 'locale', 'current_session_id', 'last_signed_in_at', 'deleted_at', 'created_at', 'updated_at'],
            Schema::getColumnListing('users'),
        );
    }

    public function test_a_user_keeps_the_last_sign_in_for_the_five_year_count(): void
    {
        $user = User::factory()->create();
        $this->assertNull($user->fresh()->last_signed_in_at);

        $user->update(['last_signed_in_at' => '2026-11-05 08:00:00']);

        $this->assertSame('2026-11-05', $user->fresh()->last_signed_in_at->toDateString());
    }

    public function test_sessions_live_in_sign_in_sessions(): void
    {
        $this->assertSame('sign_in_sessions', config('session.table'));
        $this->assertTrue(Schema::hasTable('sign_in_sessions'));
        $this->assertFalse(Schema::hasTable('sessions'));
    }

    public function test_two_staff_accounts_cannot_share_an_email_whatever_its_case(): void
    {
        StaffAccount::factory()->create(['email' => 'Luis@Example.com']);

        $this->assertRejected('23505', fn () => StaffAccount::factory()->create(['email' => 'luis@example.com']));
    }

    public function test_a_staff_account_and_a_user_may_share_an_email(): void
    {
        User::factory()->create(['email' => 'same@example.com']);
        StaffAccount::factory()->create(['email' => 'same@example.com']);

        $this->assertSame(1, StaffAccount::query()->count());
    }

    public function test_a_staff_account_is_staff_or_admin(): void
    {
        StaffAccount::factory()->create(['role' => 'staff']);
        StaffAccount::factory()->create(['role' => 'admin']);

        $this->assertRejected('23514', fn () => StaffAccount::factory()->create(['role' => 'owner']));
    }

    public function test_a_staff_account_language_is_spanish_or_english(): void
    {
        $this->assertRejected('23514', fn () => StaffAccount::factory()->create(['locale' => 'fr']));
    }

    public function test_an_invited_staff_account_has_no_password_until_the_invite_link_is_used(): void
    {
        $invited = StaffAccount::factory()->create(['password' => null]);

        $this->assertNull($invited->fresh()->password);
    }

    public function test_staff_password_resets_have_their_own_table_so_a_shared_email_never_collides(): void
    {
        DB::table('password_reset_tokens')->insert(['email' => 'same@example.com', 'token' => 'user-token-hash', 'created_at' => now()]);
        DB::table('staff_password_reset_tokens')->insert(['email' => 'same@example.com', 'token' => 'staff-token-hash', 'created_at' => now()]);

        $this->assertSame(['email', 'token', 'created_at'], Schema::getColumnListing('staff_password_reset_tokens'));
        $this->assertRejected('23505', fn () => DB::table('staff_password_reset_tokens')->insert(
            ['email' => 'same@example.com', 'token' => 'second-token-hash', 'created_at' => now()],
        ));
    }

    public function test_a_staff_account_is_active_until_deactivated_at_is_set(): void
    {
        $this->assertNull(StaffAccount::factory()->create()->deactivated_at);
        $this->assertNotNull(StaffAccount::factory()->deactivated()->create()->deactivated_at);
    }

    public function test_an_audit_entry_names_the_staff_account_or_is_a_system_alert(): void
    {
        $byStaff = AuditLogEntry::factory()->create();
        $alert = AuditLogEntry::factory()->create(['staff_account_id' => null]);

        $this->assertNotNull($byStaff->staff_account_id);
        $this->assertNull($alert->staff_account_id);
    }

    public function test_an_audit_entry_keeps_its_before_and_after_values_and_ip(): void
    {
        $entry = AuditLogEntry::factory()->create([
            'ip_address' => '203.0.113.7',
            'before_values' => ['status' => 'active'],
            'after_values' => ['status' => 'revoked'],
        ])->fresh();

        $this->assertSame('203.0.113.7', $entry->ip_address);
        $this->assertSame(['status' => 'revoked'], $entry->after_values);
    }

    public function test_an_audit_entry_ip_must_be_an_ip_address(): void
    {
        $this->assertRejected('22P02', fn () => AuditLogEntry::factory()->create(['ip_address' => 'not an ip']));
    }

    public function test_an_audit_entry_points_at_its_subject_with_no_foreign_key(): void
    {
        AuditLogEntry::factory()->create(['subject_table' => 'users', 'subject_id' => 999_999]);

        $this->assertSame(1, AuditLogEntry::query()->count());
    }

    public function test_a_staff_account_with_audit_entries_cannot_be_deleted(): void
    {
        $entry = AuditLogEntry::factory()->create();

        $this->assertRejected('23503', fn () => DB::table('staff_accounts')->where('id', $entry->staff_account_id)->delete());
    }
}
