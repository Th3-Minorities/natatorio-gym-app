<?php

namespace Tests\Feature\Auth;

use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** After 10 failed sign-ins per account and per IP, a wait that grows with each lockout (REQ-F-07). */
class StaffSignInThrottleTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        StaffAccount::factory()->create(['email' => 'luis@example.com']);
        StaffAccount::factory()->create(['email' => 'ana@example.com']);
    }

    private function signIn(string $email, string $password, string $ip = '203.0.113.7'): TestResponse
    {
        return $this->fromThePwa()
            ->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/staff/sign-in', ['email' => $email, 'password' => $password]);
    }

    private function failTimes(int $times, string $email = 'luis@example.com', string $ip = '203.0.113.7'): void
    {
        for ($i = 0; $i < $times; $i++) {
            $this->signIn($email, 'wrong-password', $ip)->assertStatus(422);
        }
    }

    public function test_nine_failures_do_not_lock_the_account(): void
    {
        $this->failTimes(9);

        $this->signIn('luis@example.com', 'password')->assertOk();
    }

    public function test_ten_failures_lock_the_account_even_for_the_right_password(): void
    {
        $this->failTimes(10);

        $this->signIn('luis@example.com', 'password')
            ->assertStatus(429)
            ->assertJsonPath('error.code', 'too_many_requests')
            ->assertHeader('Retry-After', '60');
    }

    public function test_the_account_opens_again_when_the_wait_ends(): void
    {
        $this->failTimes(10);

        $this->travel(59)->seconds();
        $this->signIn('luis@example.com', 'password')->assertStatus(429);

        $this->travel(1)->seconds();
        $this->signIn('luis@example.com', 'password')->assertOk();
    }

    public function test_the_wait_grows_with_each_lockout_up_to_an_hour(): void
    {
        foreach ([60, 300, 900, 3600, 3600] as $wait) {
            $this->failTimes(10);
            $this->signIn('luis@example.com', 'wrong-password')->assertHeader('Retry-After', (string) $wait);
            $this->travel($wait)->seconds();
        }
    }

    public function test_the_wait_goes_back_to_one_minute_a_day_after_the_last_lockout(): void
    {
        $this->failTimes(10);
        $this->travel(60)->seconds();
        $this->travel(24)->hours();

        $this->failTimes(10);
        $this->signIn('luis@example.com', 'password')->assertHeader('Retry-After', '60');
    }

    public function test_failures_are_counted_per_account_from_any_ip(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->signIn('luis@example.com', 'wrong-password', "198.51.100.{$i}");
        }

        $this->signIn('luis@example.com', 'password', '192.0.2.1')->assertStatus(429);
        $this->signIn('ana@example.com', 'password', '192.0.2.1')->assertOk();
    }

    public function test_failures_are_counted_per_ip_across_accounts(): void
    {
        $this->failTimes(5, 'luis@example.com');
        $this->failTimes(5, 'nobody@example.com');

        $this->signIn('ana@example.com', 'password')->assertStatus(429);
        $this->signIn('ana@example.com', 'password', '192.0.2.1')->assertOk();
    }

    public function test_the_email_is_counted_whatever_its_case(): void
    {
        $this->failTimes(5, 'luis@example.com', '198.51.100.1');
        $this->failTimes(5, 'LUIS@example.com', '198.51.100.2');

        $this->signIn('luis@example.com', 'password', '192.0.2.1')->assertStatus(429);
    }

    public function test_a_right_password_clears_the_account_count_but_not_the_ip_count(): void
    {
        $this->failTimes(9);
        $this->signIn('luis@example.com', 'password')->assertOk();

        // The account starts again from zero, from another IP.
        $this->failTimes(9, 'luis@example.com', '192.0.2.1');
        $this->signIn('luis@example.com', 'password', '192.0.2.1')->assertOk();

        // The first IP still has its 9 failures, so one more locks it.
        $this->failTimes(1, 'ana@example.com');
        $this->signIn('ana@example.com', 'password')->assertStatus(429);
    }
}
