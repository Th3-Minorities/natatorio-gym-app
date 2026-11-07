<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\UserPasswordController;
use App\Models\User;
use App\Notifications\UserPasswordReset;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\NotPwnedVerifier;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class UserPasswordResetTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->mock(UncompromisedVerifier::class)->shouldReceive('verify')->andReturn(true);
    }

    private function resetBody(User $user, string $token): array
    {
        return ['email' => $user->email, 'token' => $token, 'password' => 'a plain long password', 'password_confirmation' => 'a plain long password'];
    }

    public function test_password_route_limits_are_independent_for_the_same_ip(): void
    {
        Cache::flush();
        $this->freezeTime();
        $this->fromThePwa()->withServerVariables(['REMOTE_ADDR' => '198.51.100.15']);

        foreach (['email' => 10, 'validate' => 30, 'reset' => 10] as $route => $limit) {
            for ($attempt = 0; $attempt < $limit; $attempt++) {
                $this->postJson('/api/user/password/'.$route, [])->assertUnprocessable()
                    ->assertJsonPath('error.code', 'validation_failed');
            }
            $this->postJson('/api/user/password/'.$route, [])->assertStatus(429)
                ->assertJsonPath('error.code', 'too_many_requests')->assertHeader('Retry-After', '60');
        }

        $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.16']);
        foreach (['email', 'validate', 'reset'] as $route) {
            $this->postJson('/api/user/password/'.$route, [])->assertUnprocessable();
        }
    }

    public function test_reset_requests_hide_whether_the_email_exists_even_when_repeated(): void
    {
        $user = User::factory()->create(['email' => 'User@example.com']);
        foreach (['user@example.com', 'unknown@example.com', 'user@example.com'] as $email) {
            $this->fromThePwa()->postJson('/api/user/password/email', compact('email'))
                ->assertOk()->assertExactJson(['status' => 'received']);
        }
        Notification::assertSentTo($user, UserPasswordReset::class);
    }

    public function test_notification_uses_the_account_language_and_the_frontend_link(): void
    {
        foreach (['es', 'en'] as $locale) {
            $user = User::factory()->create(compact('locale'));
            $mail = (new UserPasswordReset('plain-token'))->toMail($user);
            $this->assertStringContainsString('/reset-password?token=plain-token&email=', $mail->viewData['url']);
            $this->assertSame($locale === 'es' ? 'Restablecer contraseña' : 'Reset password', $mail->subject);
        }
    }

    public function test_reset_email_is_sent_only_after_the_response_without_a_worker(): void
    {
        config(['queue.default' => 'sync']);
        $user = User::factory()->create();
        $request = Request::create('/api/user/password/email', 'POST', ['email' => $user->email]);
        $response = app(UserPasswordController::class)->email($request);
        $this->assertSame(200, $response->getStatusCode());
        Notification::assertNothingSent();
        $this->app->terminate();
        Notification::assertSentTo($user, UserPasswordReset::class);
    }

    public function test_the_link_is_validated_before_showing_the_password_form(): void
    {
        $user = User::factory()->create();
        $token = Password::broker()->createToken($user);
        $this->fromThePwa()->postJson('/api/user/password/validate', $this->resetBody($user, $token))->assertNoContent();
        $this->fromThePwa()->postJson('/api/user/password/validate', $this->resetBody($user, 'wrong'))
            ->assertUnprocessable()->assertJsonPath('error.code', 'user_reset_link_invalid');
    }

    public function test_password_reset_is_single_use_and_invalidates_existing_sign_ins(): void
    {
        $user = User::factory()->create(['current_session_id' => 'old-session']);
        $token = Password::broker()->createToken($user);
        $body = $this->resetBody($user, $token);
        $this->fromThePwa()->postJson('/api/user/password/reset', $body)->assertNoContent();
        $this->assertTrue(Hash::check($body['password'], $user->fresh()->password));
        $this->assertNull($user->fresh()->current_session_id);
        $this->fromThePwa()->postJson('/api/user/password/reset', $body)->assertUnprocessable()
            ->assertJsonPath('error.code', 'user_reset_link_invalid');
    }

    public function test_expired_links_cannot_reset_the_password(): void
    {
        $user = User::factory()->create();
        $token = Password::broker()->createToken($user);
        $this->travel(61)->minutes();
        $this->fromThePwa()->postJson('/api/user/password/reset', $this->resetBody($user, $token))
            ->assertUnprocessable()->assertJsonPath('error.code', 'user_reset_link_invalid');
    }

    public function test_short_mismatched_and_compromised_passwords_are_rejected(): void
    {
        $user = User::factory()->create();
        $token = Password::broker()->createToken($user);
        foreach ([['short', 'short'], ['long enough password', 'different password']] as [$password, $confirmation]) {
            $body = [...$this->resetBody($user, $token), 'password' => $password, 'password_confirmation' => $confirmation];
            $this->fromThePwa()->postJson('/api/user/password/reset', $body)->assertUnprocessable()
                ->assertJsonPath('error.code', 'validation_failed');
        }
        $this->mock(UncompromisedVerifier::class)->shouldReceive('verify')->andReturn(false);
        $this->fromThePwa()->postJson('/api/user/password/reset', $this->resetBody($user, $token))->assertUnprocessable();
    }

    public function test_long_passwords_without_composition_rules_are_allowed(): void
    {
        $user = User::factory()->create();
        $body = $this->resetBody($user, Password::broker()->createToken($user));
        $body['password'] = $body['password_confirmation'] = str_repeat('a', 64);
        $this->fromThePwa()->postJson('/api/user/password/reset', $body)->assertNoContent();
    }

    public function test_password_reset_uses_laravels_fallback_when_the_compromised_password_service_does_not_answer(): void
    {
        $this->app->forgetInstance(UncompromisedVerifier::class);
        $this->app->bind(UncompromisedVerifier::class, fn () => new NotPwnedVerifier(Http::getFacadeRoot()));
        Http::fake(['api.pwnedpasswords.com/*' => Http::failedConnection()]);
        $user = User::factory()->create();
        $body = $this->resetBody($user, Password::broker()->createToken($user));
        $this->fromThePwa()->postJson('/api/user/password/reset', $body)->assertNoContent();
        Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://api.pwnedpasswords.com/range/'));
        $this->assertTrue(Hash::check($body['password'], $user->fresh()->password));
    }
}
