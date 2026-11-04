<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsTest extends TestCase
{
    public function test_a_page_on_another_site_gets_no_cors_permission(): void
    {
        // The PWA and the API share one origin (the proxy), so no other site needs access.
        $this->withHeaders(['Origin' => 'https://evil.example'])
            ->getJson('/api/health')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_a_preflight_from_another_site_gets_no_cors_permission(): void
    {
        $this->withHeaders([
            'Origin' => 'https://evil.example',
            'Access-Control-Request-Method' => 'POST',
        ])->options('/api/health')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }
}
