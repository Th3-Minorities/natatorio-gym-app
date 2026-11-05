<?php

namespace Tests\Feature\Database;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** The seeder fills every data model table with fake data that follows every rule (issue #13). */
class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    /** The data model tables; Laravel's own tables (cache, jobs, sessions, resets) stay empty. */
    private const TABLES = [
        'settings', 'notices', 'facility_information', 'schedule_slots',
        'academic_terms', 'imports', 'imported_memberships',
        'staff_accounts', 'audit_log_entries',
        'users', 'roster_records', 'email_links', 'waiver_acceptances', 'authorizations',
        'facility_sessions', 'manual_visit_counts', 'daily_visit_totals',
    ];

    public function test_every_data_model_table_gets_rows(): void
    {
        $this->seed();

        foreach (self::TABLES as $table) {
            $this->assertGreaterThan(0, DB::table($table)->count(), "The seeder left {$table} empty.");
        }
    }

    public function test_the_fake_data_covers_each_kind_of_row(): void
    {
        $this->seed();

        $this->assertSame(['athlete', 'manual', 'paid'], $this->distinct('authorizations', 'type'));
        $this->assertSame(['athlete_link', 'athlete_registration', 'staff_invite'], $this->distinct('email_links', 'purpose'));
        $this->assertSame(['admin', 'staff'], $this->distinct('staff_accounts', 'role'));
        $this->assertSame(['employee', 'student'], $this->distinct('imported_memberships', 'member_group'));
        $this->assertSame(['athlete', 'manual', 'paid'], $this->distinct('facility_sessions', 'authorization_type'));
        $this->assertContains('checked_out', $this->distinct('facility_sessions', 'status'));
        $this->assertContains('active', $this->distinct('facility_sessions', 'status'));
    }

    public function test_the_help_number_is_the_office_line(): void
    {
        $this->seed();

        // The office's direct line, from the gym meeting (#62 question 24). Not personal data.
        $this->assertSame('265-3866', DB::table('settings')->where('name', 'contact_phone')->value('value'));
    }

    /** @return list<string> */
    private function distinct(string $table, string $column): array
    {
        return DB::table($table)->distinct()->orderBy($column)->pluck($column)->all();
    }
}
