<?php

namespace Tests\Feature\StaffAccounts;

use App\Models\EmailLink;
use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/**
 * The #84 security checks: a SQL and a script injection on every new input is refused, or kept and shown
 * as plain text (REQ-NF-39 and the issue's "Done when"). Inputs: invite name, email and role; role change;
 * the invitation token, password and confirmation; the reset email, token, password and confirmation;
 * the {account} part of the four account routes.
 */
class StaffAccountInjectionTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private const PASSWORD = 'una frase larga para el gimnasio';

    private StaffAccount $admin;

    /** @return array<string, array{string}> */
    public static function injections(): array
    {
        return ['SQL' => ["' OR '1'='1"], 'script' => ['<script>alert(1)</script>']];
    }

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        // The leaked-password check asks an outside service; none of these passwords is in it.
        Http::fake(['api.pwnedpasswords.com/*' => Http::response('')]);
        $this->admin = StaffAccount::factory()->admin()->create();
    }

    private function assertTablesIntact(int $accounts): void
    {
        $this->assertTrue(Schema::hasTable('staff_accounts'));
        $this->assertSame($accounts, StaffAccount::query()->count());
    }

    /** An invited account with a usable link; returns the token. */
    private function invitedToken(string $email = 'lucia.vega@example.edu'): string
    {
        $account = StaffAccount::factory()->create(['email' => $email, 'password' => null]);
        $token = 'token-'.$account->id.'-0123456789abcdef0123456789abcdef0123456789abcdef';
        EmailLink::factory()->staffInvite()->create([
            'staff_account_id' => $account->id, 'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays(7),
        ]);

        return $token;
    }

    // Invite and role

    #[DataProvider('injections')]
    public function test_the_invite_name_is_kept_as_plain_text(string $injection): void
    {
        $this->actingAs($this->admin, 'staff')->fromThePwa()
            ->postJson('/api/staff/accounts', ['name' => $injection, 'email' => 'yariel@example.edu', 'role' => 'staff'])
            ->assertCreated()->assertJsonPath('account.name', $injection);

        $this->assertSame($injection, StaffAccount::query()->where('email', 'yariel@example.edu')->value('name'));
        $this->assertTablesIntact(2);
    }

    #[DataProvider('injections')]
    public function test_the_invite_email_and_role_are_refused(string $injection): void
    {
        $this->actingAs($this->admin, 'staff')->fromThePwa();

        $this->postJson('/api/staff/accounts', ['name' => 'Yariel', 'email' => $injection, 'role' => 'staff'])
            ->assertUnprocessable()->assertJsonPath('error.details.email', ['email']);
        $this->postJson('/api/staff/accounts', ['name' => 'Yariel', 'email' => 'yariel@example.edu', 'role' => $injection])
            ->assertUnprocessable()->assertJsonPath('error.details.role', ['in']);

        Notification::assertNothingSent();
        $this->assertTablesIntact(1);
    }

    #[DataProvider('injections')]
    public function test_the_role_change_refuses_the_value(string $injection): void
    {
        $staff = StaffAccount::factory()->create();

        $this->actingAs($this->admin, 'staff')->fromThePwa()
            ->patchJson("/api/staff/accounts/{$staff->id}/role", ['role' => $injection])
            ->assertUnprocessable()->assertJsonPath('error.details.role', ['in']);

        $this->assertSame('staff', $staff->fresh()->role);
        $this->assertTablesIntact(2);
    }

    #[DataProvider('injections')]
    public function test_an_account_in_the_address_that_is_not_a_number_is_not_found(string $injection): void
    {
        $address = rawurlencode($injection);
        $this->actingAs($this->admin, 'staff')->fromThePwa();

        $this->postJson("/api/staff/accounts/{$address}/invitation")->assertNotFound();
        $this->patchJson("/api/staff/accounts/{$address}/role", ['role' => 'admin'])->assertNotFound();
        $this->postJson("/api/staff/accounts/{$address}/deactivate")->assertNotFound();
        $this->postJson("/api/staff/accounts/{$address}/reactivate")->assertNotFound();

        $this->assertTablesIntact(1);
    }

    public function test_a_number_followed_by_sql_in_the_address_is_not_found(): void
    {
        $this->actingAs($this->admin, 'staff')->fromThePwa();

        $this->postJson('/api/staff/accounts/1%20OR%201=1/invitation')->assertNotFound();
        $this->patchJson('/api/staff/accounts/1%20OR%201=1/role', ['role' => 'admin'])->assertNotFound();
        $this->postJson('/api/staff/accounts/1%20OR%201=1/deactivate')->assertNotFound();
        $this->postJson('/api/staff/accounts/1%20OR%201=1/reactivate')->assertNotFound();

        $this->assertNull($this->admin->fresh()->deactivated_at);
        $this->assertTablesIntact(1);
    }

    // Invitation link

    #[DataProvider('injections')]
    public function test_the_invitation_token_is_only_a_wrong_link(string $injection): void
    {
        $token = $this->invitedToken();

        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => $injection])
            ->assertUnprocessable()->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->fromThePwa()->postJson('/api/staff/invitation/accept', [
            'token' => $injection, 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ])->assertUnprocessable()->assertJsonPath('error.code', 'staff_invite_link_invalid');

        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => $token])->assertOk();
        $this->assertTablesIntact(2);
    }

    #[DataProvider('injections')]
    public function test_the_invitation_password_is_kept_as_plain_text_and_the_confirmation_must_match(string $injection): void
    {
        $token = $this->invitedToken();

        $this->fromThePwa()->postJson('/api/staff/invitation/accept', [
            'token' => $token, 'password' => self::PASSWORD, 'password_confirmation' => $injection,
        ])->assertUnprocessable()->assertJsonPath('error.details.password', ['confirmed']);
        $this->assertNull(StaffAccount::query()->where('email', 'lucia.vega@example.edu')->value('password'));

        $this->fromThePwa()->postJson('/api/staff/invitation/accept', [
            'token' => $token, 'password' => $injection, 'password_confirmation' => $injection,
        ])->assertNoContent();
        $account = StaffAccount::query()->where('email', 'lucia.vega@example.edu')->sole();
        $this->assertTrue(Hash::check($injection, $account->password));
        $this->assertTablesIntact(2);
    }

    // Password reset

    #[DataProvider('injections')]
    public function test_the_reset_email_is_refused(string $injection): void
    {
        $this->fromThePwa()->postJson('/api/staff/password/email', ['email' => $injection])
            ->assertUnprocessable()->assertJsonPath('error.details.email', ['email']);
        $this->fromThePwa()->postJson('/api/staff/password/validate', ['email' => $injection, 'token' => 'x'])
            ->assertUnprocessable()->assertJsonPath('error.details.email', ['email']);
        $this->fromThePwa()->postJson('/api/staff/password/reset', [
            'email' => $injection, 'token' => 'x', 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ])->assertUnprocessable()->assertJsonPath('error.details.email', ['email']);

        Notification::assertNothingSent();
        $this->assertTablesIntact(1);
    }

    #[DataProvider('injections')]
    public function test_the_reset_token_is_only_a_wrong_link(string $injection): void
    {
        $email = $this->admin->email;

        $this->fromThePwa()->postJson('/api/staff/password/validate', ['email' => $email, 'token' => $injection])
            ->assertUnprocessable()->assertJsonPath('error.code', 'staff_reset_link_invalid');
        $this->fromThePwa()->postJson('/api/staff/password/reset', [
            'email' => $email, 'token' => $injection, 'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ])->assertUnprocessable()->assertJsonPath('error.code', 'staff_reset_link_invalid');

        $this->assertTrue(Hash::check('password', $this->admin->fresh()->password));
        $this->assertTablesIntact(1);
    }

    #[DataProvider('injections')]
    public function test_the_reset_password_is_kept_as_plain_text_and_the_confirmation_must_match(string $injection): void
    {
        $email = $this->admin->email;
        $token = Password::broker('staff_accounts')->createToken($this->admin);

        $this->fromThePwa()->postJson('/api/staff/password/reset', [
            'email' => $email, 'token' => $token, 'password' => self::PASSWORD, 'password_confirmation' => $injection,
        ])->assertUnprocessable()->assertJsonPath('error.details.password', ['confirmed']);
        $this->assertTrue(Hash::check('password', $this->admin->fresh()->password));

        $this->fromThePwa()->postJson('/api/staff/password/reset', [
            'email' => $email, 'token' => $token, 'password' => $injection, 'password_confirmation' => $injection,
        ])->assertNoContent();
        $this->assertTrue(Hash::check($injection, $this->admin->fresh()->password));
        $this->assertTablesIntact(1);
    }
}
