<?php

namespace Tests\Feature\Database;

use App\Models\Authorization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
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

    public function test_every_seeded_person_has_an_email_that_matches_the_name(): void
    {
        $this->seed();

        $people = DB::table('waiver_acceptances')->join('users', 'users.id', '=', 'waiver_acceptances.user_id')
            ->get(['waiver_acceptances.full_name', 'users.email', 'waiver_acceptances.email as waiver_email']);

        $this->assertNotEmpty($people);
        foreach ($people as $person) {
            $this->assertSame($person->email, $person->waiver_email);
            $this->assertEmailMatchesName($person->full_name, $person->email);
        }

        foreach ([['staff_accounts', 'name', 'email'], ['roster_records', 'name', 'institutional_email'], ['imported_memberships', 'name', 'email']] as [$table, $nameColumn, $emailColumn]) {
            $rows = DB::table($table)->get([$nameColumn, $emailColumn]);

            $this->assertNotEmpty($rows, "The seeder left {$table} empty.");
            foreach ($rows as $row) {
                $this->assertEmailMatchesName($row->$nameColumn, $row->$emailColumn);
            }
        }
    }

    public function test_the_load_test_waivers_use_the_account_email(): void
    {
        $this->seed();
        $this->artisan('db:seed', ['--class' => 'LoadTestSeeder'])->assertSuccessful();

        $waivers = DB::table('waiver_acceptances')->join('users', 'users.id', '=', 'waiver_acceptances.user_id')
            ->where('users.email', 'like', 'load-%')->get(['users.email', 'waiver_acceptances.email as waiver_email']);

        $this->assertCount(100, $waivers);
        foreach ($waivers as $waiver) {
            $this->assertSame($waiver->email, $waiver->waiver_email);
        }
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

    public function test_the_denied_access_cases_have_no_current_authorization_and_the_valid_ones_do(): void
    {
        $this->seed();

        foreach (['pago-vencido', 'atleta-removido', 'orden-cancelada', 'sin-autorizacion'] as $name) {
            $user = User::query()->where('email', "{$name}@example.com")->firstOrFail();
            $this->assertNull($user->currentAuthorization(), "{$name} must not have a current authorization.");
        }

        foreach (['paid', 'athlete'] as $type) {
            $user = Authorization::query()->where('type', $type)->where('status', 'active')->firstOrFail()->user;
            $this->assertNotNull($user->currentAuthorization(), "A {$type} user must have a current authorization.");
        }
    }

    public function test_the_load_test_seeder_creates_no_users_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->artisan('db:seed', ['--class' => 'LoadTestSeeder', '--force' => true])->assertSuccessful();

        $this->assertSame(0, User::query()->where('email', 'like', 'load-%')->count());
    }

    private function assertEmailMatchesName(string $name, string $email): void
    {
        if (! str_ends_with($email, '@example.com')) {
            $this->assertSame(Str::slug($name, '.'), explode('@', $email)[0], "{$email} does not match {$name}.");
        }
    }

    /** @return list<string> */
    private function distinct(string $table, string $column): array
    {
        return DB::table($table)->distinct()->orderBy($column)->pluck($column)->all();
    }
}
