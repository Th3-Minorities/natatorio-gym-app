<?php

namespace Tests\Feature\Database;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\AssertsDatabaseRules;
use Tests\TestCase;

/** Rules for staff_accounts and audit_log_entries (data-model.md sections 4 to 6, D13). */
class StaffAndAuditTablesTest extends TestCase
{
    use AssertsDatabaseRules, RefreshDatabase;

    public function test_one_staff_account_per_email_ignoring_case(): void
    {
        DB::table('staff_accounts')->insert($this->staffRow(['email' => 'Rivera@uprm.edu']));

        $this->assertRejected('23505', fn () => DB::table('staff_accounts')->insert($this->staffRow(['email' => 'rivera@UPRM.edu'])));
    }

    public function test_a_staff_account_is_staff_or_admin(): void
    {
        DB::table('staff_accounts')->insert($this->staffRow(['email' => 'a@uprm.edu', 'role' => 'staff']));
        DB::table('staff_accounts')->insert($this->staffRow(['email' => 'b@uprm.edu', 'role' => 'admin']));

        $this->assertRejected('23514', fn () => DB::table('staff_accounts')->insert($this->staffRow(['email' => 'c@uprm.edu', 'role' => 'owner'])));
    }

    public function test_staff_language_is_spanish_or_english(): void
    {
        $this->assertRejected('23514', fn () => DB::table('staff_accounts')->insert($this->staffRow(['locale' => 'fr'])));
    }

    public function test_a_staff_account_with_audit_entries_cannot_be_deleted(): void
    {
        $entry = AuditLogEntry::factory()->create();

        $this->assertRejected('23503', fn () => DB::table('staff_accounts')->where('id', $entry->staff_account_id)->delete());
    }

    public function test_a_system_alert_has_no_staff_account(): void
    {
        DB::table('audit_log_entries')->insert(['action' => 'import_failed', 'occurred_at' => '2026-11-04 10:00:00']);

        $this->assertSame(1, DB::table('audit_log_entries')->whereNull('staff_account_id')->count());
    }

    public function test_audit_entries_have_no_foreign_key_to_their_subject(): void
    {
        $staffId = DB::table('staff_accounts')->insertGetId($this->staffRow());

        // The affected record may be deleted later; its entry must stay (REQ-NF-39).
        DB::table('audit_log_entries')->insert([
            'staff_account_id' => $staffId,
            'action' => 'roster_record_updated',
            'subject_table' => 'roster_records',
            'subject_id' => 999,
            'occurred_at' => '2026-11-04 10:00:00',
        ]);

        $this->assertSame(1, DB::table('audit_log_entries')->where('subject_id', 999)->count());
    }

    public function test_an_audit_entry_needs_an_action_and_a_time(): void
    {
        $this->assertRejected('23502', fn () => DB::table('audit_log_entries')->insert(['occurred_at' => '2026-11-04 10:00:00']));
        $this->assertRejected('23502', fn () => DB::table('audit_log_entries')->insert(['action' => 'term_created', 'occurred_at' => null]));
    }

    public function test_the_factories_make_valid_rows(): void
    {
        StaffAccount::factory()->count(2)->create();
        StaffAccount::factory()->admin()->create();
        AuditLogEntry::factory()->count(3)->create();

        $this->assertSame(1, DB::table('staff_accounts')->where('role', 'admin')->count());
        $this->assertSame(3, DB::table('audit_log_entries')->count());
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function staffRow(array $overrides = []): array
    {
        return [
            'name' => 'Luis Rivera',
            'email' => 'luis@uprm.edu',
            'password' => 'not-a-real-hash',
            'role' => 'staff',
            'locale' => 'es',
            ...$overrides,
        ];
    }
}
