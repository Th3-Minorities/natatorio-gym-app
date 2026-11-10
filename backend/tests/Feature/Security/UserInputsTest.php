<?php

namespace Tests\Feature\Security;

use App\Models\User;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class UserInputsTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    public function test_sql_and_script_on_each_new_input_cannot_bypass_auth_or_change_another_account(): void
    {
        Notification::fake();
        $this->mock(UncompromisedVerifier::class)->shouldReceive('verify')->andReturn(true);
        $user = User::factory()->create(['email' => 'user@example.com', 'current_session_id' => 'device']);
        foreach (["' OR '1'='1", "x'; DROP TABLE users; --", '<script>alert(1)</script>'] as $input) {
            Cache::flush();
            foreach (['email', 'password'] as $field) {
                $this->fromThePwa()->postJson('/api/user/sign-in', array_replace(['email' => $user->email, 'password' => 'wrong'], [$field => $input]))
                    ->assertUnprocessable()->assertDontSee('<script>', escape: false);
            }
            $this->fromThePwa()->postJson('/api/user/password/email', ['email' => $input])->assertUnprocessable();
            foreach (['email', 'token'] as $field) {
                $body = ['email' => $user->email, 'token' => Password::broker()->createToken($user)];
                $body[$field] = $input;
                $this->fromThePwa()->postJson('/api/user/password/validate', $body)
                    ->assertUnprocessable()->assertDontSee('<script>', escape: false);
            }
            foreach (['email', 'token', 'password', 'password_confirmation'] as $field) {
                Cache::flush();
                $body = ['email' => $user->email, 'token' => Password::broker()->createToken($user),
                    'password' => 'a long password', 'password_confirmation' => 'a long password'];
                $body[$field] = $input;
                $this->fromThePwa()->postJson('/api/user/password/reset', $body)->assertUnprocessable()->assertDontSee('<script>', escape: false);
            }
            $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa()
                ->patchJson('/api/user/locale', ['locale' => $input])->assertUnprocessable();
            $this->app['auth']->forgetGuards();
        }
        $this->assertTrue(Schema::hasTable('users'));
        $this->assertSame(1, User::query()->count());
    }

    public function test_all_new_inputs_reject_arrays_and_oversized_strings(): void
    {
        $user = User::factory()->create();
        foreach ([['bad'], str_repeat('a', 1001)] as $invalid) {
            foreach (['email', 'password'] as $field) {
                $this->fromThePwa()->postJson('/api/user/sign-in', [$field => $invalid])->assertUnprocessable();
            }
            $this->fromThePwa()->postJson('/api/user/password/email', ['email' => $invalid])->assertUnprocessable();
            foreach (['email', 'token'] as $field) {
                $body = ['email' => $user->email, 'token' => Password::broker()->createToken($user)];
                $body[$field] = $invalid;
                $this->fromThePwa()->postJson('/api/user/password/validate', $body)
                    ->assertUnprocessable()->assertDontSee('<script>', escape: false);
            }
            foreach (['email', 'token', 'password', 'password_confirmation'] as $field) {
                Cache::flush();
                $this->fromThePwa()->postJson('/api/user/password/reset', [$field => $invalid])->assertUnprocessable();
            }
        }
    }
}
