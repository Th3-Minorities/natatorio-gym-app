<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ProxyHeadersTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Route::get('api/test/visitor', fn (Request $request) => [
            'ip' => $request->ip(),
            'secure' => $request->isSecure(),
            'host' => $request->getHost(),
        ]);
    }

    public function test_the_visitor_ip_and_https_come_from_the_proxy_headers(): void
    {
        // The proxy container (172.18.0.5) and the host (192.168.65.1) are private. The visitor is the last public address.
        $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5'])
            ->withHeaders(['X-Forwarded-For' => '198.51.100.9, 203.0.113.7, 192.168.65.1', 'X-Forwarded-Proto' => 'https'])
            ->getJson('/api/test/visitor')
            ->assertExactJson(['ip' => '203.0.113.7', 'secure' => true, 'host' => 'localhost']);
    }

    public function test_a_visitor_cannot_choose_the_host_of_the_links(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '172.18.0.5'])
            ->withHeaders(['X-Forwarded-Host' => 'evil.example'])
            ->getJson('/api/test/visitor')
            ->assertJsonPath('host', 'localhost');
    }

    public function test_headers_from_a_public_address_are_ignored(): void
    {
        $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.50'])
            ->withHeaders(['X-Forwarded-For' => '10.9.9.9', 'X-Forwarded-Proto' => 'https'])
            ->getJson('/api/test/visitor')
            ->assertExactJson(['ip' => '203.0.113.50', 'secure' => false, 'host' => 'localhost']);
    }
}
