<?php

namespace Tests\Feature\Console;

use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/** The install command creates the first Administrator (REQ-F-88, REQ-NF-52). */
class CreateAdministratorCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_the_first_administrator_and_shows_the_password_once(): void
    {
        $exitCode = Artisan::call('staff:create-admin', ['--name' => 'Ana Rivera', '--email' => 'ana@example.com']);
        $output = Artisan::output();

        $this->assertSame(0, $exitCode);
        $admin = StaffAccount::query()->sole();
        $this->assertSame('Ana Rivera', $admin->name);
        $this->assertSame('ana@example.com', $admin->email);
        $this->assertSame('admin', $admin->role);
        $this->assertSame('es', $admin->locale);
        $this->assertNull($admin->deactivated_at);

        $this->assertMatchesRegularExpression('/Password: (\S{16,})/', $output);
        preg_match('/Password: (\S+)/', $output, $match);
        $this->assertTrue(Hash::check($match[1], $admin->password));
    }

    public function test_the_language_can_be_english(): void
    {
        Artisan::call('staff:create-admin', ['--name' => 'Ana Rivera', '--email' => 'ana@example.com', '--locale' => 'en']);

        $this->assertSame('en', StaffAccount::query()->sole()->locale);
    }

    public function test_it_refuses_when_an_active_administrator_exists(): void
    {
        // A restore brings its own Administrators, so a second run never needs to add one.
        StaffAccount::factory()->admin()->create();

        $exitCode = Artisan::call('staff:create-admin', ['--name' => 'Ana Rivera', '--email' => 'ana@example.com']);

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('An active Administrator already exists', Artisan::output());
        $this->assertSame(1, StaffAccount::query()->count());
    }

    public function test_active_staff_or_a_deactivated_administrator_do_not_block_it(): void
    {
        StaffAccount::factory()->create();
        StaffAccount::factory()->admin()->deactivated()->create();

        $this->assertSame(0, Artisan::call('staff:create-admin', ['--name' => 'Ana Rivera', '--email' => 'ana@example.com']));
    }

    public function test_it_refuses_an_email_another_staff_account_uses_whatever_its_case(): void
    {
        StaffAccount::factory()->create(['email' => 'Ana@Example.com']);

        $exitCode = Artisan::call('staff:create-admin', ['--name' => 'Ana Rivera', '--email' => 'ana@example.com']);

        $this->assertSame(1, $exitCode);
        $this->assertStringContainsString('email', Artisan::output());
        $this->assertSame(1, StaffAccount::query()->count());
    }

    public function test_it_refuses_a_bad_email_or_an_empty_name(): void
    {
        $this->assertSame(1, Artisan::call('staff:create-admin', ['--name' => 'Ana Rivera', '--email' => 'not-an-email']));
        $this->assertSame(1, Artisan::call('staff:create-admin', ['--name' => '   ', '--email' => 'ana@example.com', '--no-interaction' => true]));
        $this->assertSame(1, Artisan::call('staff:create-admin', ['--name' => 'Ana', '--email' => 'ana@example.com', '--locale' => 'fr']));

        $this->assertSame(0, StaffAccount::query()->count());
    }
}
