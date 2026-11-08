<?php

namespace Tests\Feature\Database;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** The seeder fills every data model table with fake data that follows every rule (issue #13). */
class DatabaseSeederTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    /** The data model tables; Laravel's framework tables (cache, jobs, password_reset_tokens) stay empty. */
    private const TABLES = [
        'settings', 'notices', 'facility_information', 'schedule_slots',
        'academic_terms', 'imports', 'imported_memberships',
        'staff_accounts', 'staff_password_reset_tokens', 'audit_log_entries',
        'users', 'roster_records', 'email_links', 'waiver_acceptances', 'authorizations',
        'sign_in_sessions', 'facility_sessions', 'manual_visit_counts', 'daily_visit_totals',
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
        $this->assertContains('expired', $this->distinct('facility_sessions', 'status'));
        $this->assertContains('ended_early', $this->distinct('facility_sessions', 'status'));
        $this->assertContains('void', $this->distinct('facility_sessions', 'status'));
        $this->assertGreaterThan(0, DB::table('facility_sessions')->whereNotNull('entered_by_staff_account_id')->count());
    }

    public function test_the_help_number_is_the_office_line(): void
    {
        $this->seed();

        // The office's direct line, from the gym meeting (#62 question 24). Not personal data.
        $this->assertSame('265-3866', DB::table('settings')->where('name', 'contact_phone')->value('value'));
    }

    public function test_it_seeds_the_browser_test_user_outside_production(): void
    {
        $this->seed();

        $email = env('E2E_USER_EMAIL', 'user@example.com');
        $password = env('E2E_USER_PASSWORD', 'test-user-password-129');
        $user = User::query()->where('email', $email)->firstOrFail();

        $this->assertTrue(Hash::check($password, $user->password));
        $this->fromThePwa()->postJson('/api/user/sign-in', compact('email', 'password'))->assertOk();
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_it_does_not_seed_fake_data_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('db:seed', ['--force' => true])->assertSuccessful();

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('staff_accounts', 0);
        $this->assertDatabaseCount('settings', 0);
    }

    /** @return list<string> */
    private function distinct(string $table, string $column): array
    {
        return DB::table($table)->distinct()->orderBy($column)->pluck($column)->all();
    }
}
