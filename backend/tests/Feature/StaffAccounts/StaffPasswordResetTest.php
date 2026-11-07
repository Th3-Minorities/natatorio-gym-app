<?php

namespace Tests\Feature\StaffAccounts;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use App\Models\User;
use App\Notifications\StaffPasswordReset;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** A Staff member or Administrator who forgot their password resets it by email (REQ-F-88, N-11). */
class StaffPasswordResetTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private const NEW_PASSWORD = 'una frase nueva y larga';

    private StaffAccount $account;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->mock(UncompromisedVerifier::class)->shouldReceive('verify')->andReturn(true);
        $this->account = StaffAccount::factory()->create(['email' => 'Mariel.Velez@example.edu']);
    }

    private function token(?StaffAccount $account = null): string
    {
        return Password::broker('staff_accounts')->createToken($account ?? $this->account);
    }

    private function reset(string $token, array $input = []): TestResponse
    {
        return $this->fromThePwa()->postJson('/api/staff/password/reset', [
            'email' => $this->account->email,
            'token' => $token,
            'password' => self::NEW_PASSWORD,
            'password_confirmation' => self::NEW_PASSWORD,
            ...$input,
        ]);
    }

    public function test_the_answer_never_says_whether_the_email_has_an_account(): void
    {
        $invited = StaffAccount::factory()->create(['password' => null]);
        $deactivated = StaffAccount::factory()->deactivated()->create();
        $user = User::factory()->create();

        foreach (['mariel.velez@example.edu', 'nobody@example.edu', $invited->email, $deactivated->email, $user->email] as $email) {
            $this->fromThePwa()->postJson('/api/staff/password/email', ['email' => $email])
                ->assertOk()->assertExactJson(['status' => 'received']);
        }

        // Only the active staff account gets an email; invited people use their invitation.
        Notification::assertSentTo($this->account, StaffPasswordReset::class);
        Notification::assertSentTimes(StaffPasswordReset::class, 1);
    }

    public function test_the_email_uses_the_account_language_and_the_staff_link(): void
    {
        foreach (['es' => 'Restablecer contraseña', 'en' => 'Reset password'] as $locale => $subject) {
            $account = StaffAccount::factory()->create(['locale' => $locale]);
            $mail = (new StaffPasswordReset('plain-token'))->toMail($account);
            $this->assertSame($subject, $mail->subject);
            $this->assertStringContainsString('/staff/restablecer?token=plain-token&email=', $mail->viewData['url']);
        }
    }

    public function test_a_valid_link_is_accepted_and_a_wrong_one_refused(): void
    {
        $token = $this->token();

        $this->fromThePwa()->postJson('/api/staff/password/validate', ['email' => 'MARIEL.velez@example.edu', 'token' => $token])
            ->assertNoContent();
        $this->fromThePwa()->postJson('/api/staff/password/validate', ['email' => $this->account->email, 'token' => 'wrong'])
            ->assertUnprocessable()->assertExactJson(['error' => ['code' => 'staff_reset_link_invalid']]);
        $this->fromThePwa()->postJson('/api/staff/password/validate', ['email' => 'nobody@example.edu', 'token' => $token])
            ->assertUnprocessable()->assertJsonPath('error.code', 'staff_reset_link_invalid');
    }

    public function test_resetting_sets_the_password_uses_up_the_link_and_writes_the_log(): void
    {
        $token = $this->token();

        $this->reset($token)->assertNoContent();

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $this->account->fresh()->password));
        $this->reset($token)->assertUnprocessable()->assertJsonPath('error.code', 'staff_reset_link_invalid');
        $entry = AuditLogEntry::query()->where('action', 'staff.password_reset')->sole();
        $this->assertSame($this->account->id, $entry->staff_account_id);
    }

    public function test_resetting_signs_the_account_out_everywhere(): void
    {
        $elsewhere = $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $this->account->email, 'password' => 'password'])->assertOk();
        $this->keepingTheSessionOf($elsewhere)->getJson('/api/staff/me')->assertOk();

        $this->reset($this->token())->assertNoContent();

        $this->keepingTheSessionOf($elsewhere)->getJson('/api/staff/me')
            ->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
        $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $this->account->email, 'password' => self::NEW_PASSWORD])->assertOk();
    }

    public function test_an_expired_link_is_refused(): void
    {
        $token = $this->token();
        $this->travel(61)->minutes();

        $this->reset($token)->assertJsonPath('error.code', 'staff_reset_link_invalid');
        $this->assertTrue(Hash::check('password', $this->account->fresh()->password));
    }

    public function test_a_deactivated_account_cannot_reset(): void
    {
        $token = $this->token();
        $this->account->forceFill(['deactivated_at' => now()])->save();

        $this->reset($token)->assertJsonPath('error.code', 'staff_reset_link_invalid');
        $this->assertTrue(Hash::check('password', $this->account->fresh()->password));
    }

    public function test_a_user_reset_token_does_not_work_for_staff(): void
    {
        // A User and a staff account may share an email; their reset tokens live apart.
        $user = User::factory()->create(['email' => $this->account->email]);
        $userToken = Password::broker()->createToken($user);

        $this->reset($userToken)->assertJsonPath('error.code', 'staff_reset_link_invalid');
    }

    public function test_the_inputs_are_checked_on_the_server(): void
    {
        $token = $this->token();
        $this->reset($token, ['password' => 'corta', 'password_confirmation' => 'corta'])
            ->assertJsonPath('error.details.password', ['password']);
        $this->reset($token, ['password_confirmation' => 'otra frase distinta'])
            ->assertJsonPath('error.details.password', ['confirmed']);
        $this->fromThePwa()->postJson('/api/staff/password/email', ['email' => "x' OR '1'='1"])
            ->assertJsonPath('error.details.email', ['email']);
        $this->fromThePwa()->postJson('/api/staff/password/email', ['email' => ['a@example.edu']])
            ->assertJsonPath('error.code', 'validation_failed');
    }

    public function test_each_route_has_its_own_limit_per_ip(): void
    {
        Cache::flush();
        $this->freezeTime();

        foreach (['email' => 10, 'validate' => 30, 'reset' => 10] as $route => $limit) {
            for ($i = 0; $i < $limit; $i++) {
                $this->fromThePwa()->postJson('/api/staff/password/'.$route, [])->assertUnprocessable();
            }
            $this->fromThePwa()->postJson('/api/staff/password/'.$route, [])->assertTooManyRequests();
        }
    }
}
