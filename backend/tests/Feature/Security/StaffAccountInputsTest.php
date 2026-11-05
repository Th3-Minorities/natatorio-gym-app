<?php

namespace Tests\Feature\Security;

use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/**
 * The #16 security checks: every new input is validated on the server, SQL and script
 * injections are refused or kept as plain text, and no query is built from user text.
 * Inputs: sign-in email and password, install command name and email.
 */
class StaffAccountInputsTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private const SQL_INJECTIONS = [
        "' OR '1'='1",
        "admin@example.com' --",
        "x'; DROP TABLE staff_accounts; --",
    ];

    private const SCRIPT = '<script>alert(1)</script>';

    protected function setUp(): void
    {
        parent::setUp();

        StaffAccount::factory()->admin()->create(['email' => 'admin@example.com']);
    }

    public function test_sql_in_the_sign_in_email_or_password_signs_nobody_in(): void
    {
        foreach (self::SQL_INJECTIONS as $injection) {
            $this->fromThePwa()
                ->postJson('/api/staff/sign-in', ['email' => $injection, 'password' => 'password'])
                ->assertStatus(422)
                ->assertJsonPath('error.code', 'staff_credentials_invalid');
            $this->fromThePwa()
                ->postJson('/api/staff/sign-in', ['email' => 'admin@example.com', 'password' => $injection])
                ->assertJsonPath('error.code', 'staff_credentials_invalid');
        }

        $this->assertGuest('staff');
        $this->assertTrue(Schema::hasTable('staff_accounts'));
        $this->assertSame(1, StaffAccount::query()->count());
    }

    public function test_a_script_in_the_sign_in_email_is_never_echoed_back(): void
    {
        $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => self::SCRIPT, 'password' => self::SCRIPT])
            ->assertStatus(422)
            ->assertDontSee('<script>', escape: false);
    }

    public function test_sign_in_fields_must_be_short_strings(): void
    {
        $tooLong = str_repeat('a', 256);

        foreach ([
            ['email' => ['admin@example.com'], 'password' => 'password'],
            ['email' => 'admin@example.com', 'password' => ['password']],
            ['email' => $tooLong, 'password' => 'password'],
            ['email' => 'admin@example.com', 'password' => $tooLong],
        ] as $body) {
            $this->fromThePwa()
                ->postJson('/api/staff/sign-in', $body)
                ->assertStatus(422)
                ->assertJsonPath('error.code', 'validation_failed');
        }
    }

    public function test_the_install_command_keeps_a_script_or_sql_in_the_name_as_plain_text(): void
    {
        StaffAccount::query()->delete();
        $name = self::SCRIPT."'; DROP TABLE staff_accounts; --";

        Artisan::call('staff:create-admin', ['--name' => $name, '--email' => 'ana@example.com']);

        $admin = StaffAccount::query()->sole();
        $this->assertSame($name, $admin->name);

        // The API sends it back as a JSON string, never as HTML; the PWA must show it as text.
        $this->actingAs($admin, 'staff')
            ->fromThePwa()
            ->getJson('/api/staff/me')
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonPath('name', $name);
    }

    public function test_the_install_command_refuses_sql_or_a_script_as_the_email(): void
    {
        StaffAccount::query()->delete();

        foreach ([...self::SQL_INJECTIONS, self::SCRIPT] as $injection) {
            $this->assertSame(1, Artisan::call('staff:create-admin', ['--name' => 'Ana', '--email' => $injection]));
        }

        $this->assertSame(0, StaffAccount::query()->count());
        $this->assertTrue(Schema::hasTable('staff_accounts'));
    }
}
