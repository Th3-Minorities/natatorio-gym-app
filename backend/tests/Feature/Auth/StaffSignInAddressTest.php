<?php

namespace Tests\Feature\Auth;

use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The PWA and the API always share one address (architecture.md, D2), whatever that address is: the dev
 * server, the phone tunnel, or the app's UPRM subdomain. Sanctum must start a cookie session for any of them,
 * and refuse cleanly for a page on another site.
 */
class StaffSignInAddressTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        StaffAccount::factory()->create(['email' => 'luis@example.com']);
    }

    private function signInFrom(string $host, string $origin)
    {
        return $this->withServerVariables(['HTTP_HOST' => $host])
            ->withHeaders(['Origin' => $origin, 'Accept' => 'application/json'])
            ->postJson("http://{$host}/api/staff/sign-in", ['email' => 'luis@example.com', 'password' => 'password']);
    }

    public function test_the_dev_server_address_can_sign_in(): void
    {
        $this->signInFrom('localhost:5173', 'http://localhost:5173')->assertOk();
    }

    public function test_a_phone_tunnel_address_can_sign_in(): void
    {
        // The Cloudflare Quick Tunnel address changes on every run, so no fixed list can hold it.
        $this->signInFrom('gave-enclosed-onion-warranties.trycloudflare.com', 'https://gave-enclosed-onion-warranties.trycloudflare.com')
            ->assertOk();
    }

    public function test_a_page_on_another_site_gets_a_clean_refusal_not_a_crash(): void
    {
        $this->signInFrom('localhost:8080', 'https://evil.example.com')
            ->assertStatus(419)
            ->assertJsonPath('error.code', 'session_expired');

        $this->assertGuest('staff');
    }
}
