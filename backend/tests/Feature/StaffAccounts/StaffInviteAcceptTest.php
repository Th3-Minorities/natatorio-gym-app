<?php

namespace Tests\Feature\StaffAccounts;

use App\Models\AuditLogEntry;
use App\Models\EmailLink;
use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** The invited person opens the email link and sets their own password (REQ-F-88, N-11 "Crear tu contraseña"). */
class StaffInviteAcceptTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private const TOKEN = 'a-token-from-the-invitation-email-0123456789abcdef0123456789abcd';

    private const PASSWORD = 'una frase larga para el gimnasio';

    private StaffAccount $account;

    private EmailLink $link;

    /** What the leaked-password service answers: hash suffixes it has seen leaked. */
    private string $leakedSuffixes = '';

    protected function setUp(): void
    {
        parent::setUp();
        // The leaked-password check asks an outside service; tests answer for it.
        Http::fake(['api.pwnedpasswords.com/*' => fn () => Http::response($this->leakedSuffixes)]);
        $this->account = StaffAccount::factory()->admin()->create([
            'name' => 'Lucía Vega Ramos', 'email' => 'lucia.vega@example.edu', 'password' => null,
        ]);
        $this->link = EmailLink::factory()->staffInvite()->create([
            'staff_account_id' => $this->account->id,
            'token_hash' => hash('sha256', self::TOKEN),
            'expires_at' => now()->addDays(7),
        ]);
    }

    private function accept(array $input = []): TestResponse
    {
        return $this->fromThePwa()->postJson('/api/staff/invitation/accept', [
            'token' => self::TOKEN,
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
            ...$input,
        ]);
    }

    public function test_a_valid_link_shows_who_was_invited(): void
    {
        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => self::TOKEN])
            ->assertOk()
            ->assertExactJson(['name' => 'Lucía Vega Ramos', 'email' => 'lucia.vega@example.edu', 'role' => 'admin']);
    }

    public function test_setting_the_password_activates_the_account_and_uses_up_the_link(): void
    {
        $this->accept()->assertNoContent();

        $this->assertTrue(Hash::check(self::PASSWORD, $this->account->fresh()->password));
        $this->assertNotNull($this->link->fresh()->used_at);

        $entry = AuditLogEntry::query()->where('action', 'staff.invite_accept')->sole();
        $this->assertSame($this->account->id, $entry->staff_account_id);
        $this->assertSame($this->account->id, $entry->subject_id);
    }

    public function test_the_person_can_then_sign_in(): void
    {
        $this->accept()->assertNoContent();

        $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => 'lucia.vega@example.edu', 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('role', 'admin');
    }

    public function test_a_used_link_cannot_be_used_again(): void
    {
        $this->accept()->assertNoContent();

        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => self::TOKEN])
            ->assertUnprocessable()->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->accept(['password' => 'otra frase larga distinta', 'password_confirmation' => 'otra frase larga distinta'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->assertTrue(Hash::check(self::PASSWORD, $this->account->fresh()->password));
    }

    public function test_an_expired_link_is_refused(): void
    {
        $this->travel(7)->days();
        $this->travel(1)->seconds();

        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => self::TOKEN])
            ->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->accept()->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->assertNull($this->account->fresh()->password);
    }

    public function test_an_unknown_token_gets_the_same_answer(): void
    {
        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => 'not-a-real-token'])
            ->assertUnprocessable()->assertExactJson(['error' => ['code' => 'staff_invite_link_invalid']]);
    }

    public function test_a_deactivated_account_cannot_use_its_link(): void
    {
        $this->account->forceFill(['deactivated_at' => now()])->save();

        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => self::TOKEN])
            ->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->accept()->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->assertNull($this->account->fresh()->password);
    }

    public function test_the_password_rules_are_checked_on_the_server(): void
    {
        $this->accept(['password' => 'corta', 'password_confirmation' => 'corta'])
            ->assertUnprocessable()->assertJsonPath('error.details.password', ['password']);
        $this->accept(['password_confirmation' => 'otra cosa distinta'])
            ->assertJsonPath('error.details.password', ['confirmed']);
        $this->accept(['token' => ''])->assertJsonPath('error.details.token', ['required']);

        $this->assertNull($this->account->fresh()->password);
        $this->assertNull($this->link->fresh()->used_at);
    }

    public function test_a_leaked_password_is_refused(): void
    {
        $this->leakedSuffixes = substr(strtoupper(sha1(self::PASSWORD)), 5).':42';

        $this->accept()->assertUnprocessable()->assertJsonPath('error.details.password', ['password']);
    }

    public function test_injection_in_the_token_is_only_a_wrong_link(): void
    {
        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => "' OR '1'='1"])
            ->assertJsonPath('error.code', 'staff_invite_link_invalid');
        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => ['array']])
            ->assertJsonPath('error.details.token', ['string']);
    }

    public function test_the_routes_are_limited_per_ip(): void
    {
        for ($i = 0; $i < 30; $i++) {
            $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => "wrong-{$i}"]);
        }

        $this->fromThePwa()->postJson('/api/staff/invitation/validate', ['token' => self::TOKEN])
            ->assertTooManyRequests();
    }
}
