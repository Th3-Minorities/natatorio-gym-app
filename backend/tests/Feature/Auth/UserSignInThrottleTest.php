<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class UserSignInThrottleTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        User::factory()->create(['email' => 'user@example.com']);
    }

    private function attempt(string $email = 'user@example.com', string $ip = '198.51.100.1', string $password = 'wrong')
    {
        return $this->fromThePwa()->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/user/sign-in', compact('email', 'password'));
    }

    public function test_tenth_failure_starts_a_wait_and_each_subsequent_lockout_grows(): void
    {
        $this->freezeTime();
        foreach ([60, 300, 900, 3600] as $wait) {
            for ($i = 0; $i < 10; $i++) {
                $this->attempt()->assertUnprocessable();
            }
            $this->attempt(password: 'password')->assertStatus(429)->assertHeader('Retry-After', (string) $wait);
            $this->travel($wait)->seconds();
        }
        $this->attempt(password: 'password')->assertOk();
    }

    public function test_account_limit_follows_the_email_across_ip_addresses_and_case(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->attempt($i % 2 ? 'USER@example.com' : 'user@example.com', "198.51.100.{$i}");
        }
        $this->attempt(ip: '192.0.2.1', password: 'password')->assertStatus(429);
    }

    public function test_ip_limit_follows_failures_across_accounts(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->attempt("unknown{$i}@example.com");
        }
        $this->attempt(password: 'password')->assertStatus(429);
        $this->attempt(ip: '192.0.2.1', password: 'password')->assertOk();
    }

    public function test_a_success_clears_only_the_account_count(): void
    {
        for ($i = 0; $i < 9; $i++) {
            $this->attempt();
        }
        $this->attempt(password: 'password')->assertOk();
        $this->attempt('unknown@example.com');
        $this->attempt(password: 'password')->assertStatus(429);
        $this->attempt(ip: '192.0.2.1', password: 'password')->assertOk();
    }
}
