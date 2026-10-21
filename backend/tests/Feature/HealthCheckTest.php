<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_health_check_answers_ok_when_the_database_is_reachable(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertExactJson(['status' => 'ok']);
    }

    public function test_health_check_answers_503_when_the_database_is_down(): void
    {
        DB::shouldReceive('select')->andThrow(new \RuntimeException('connection refused'));

        $this->getJson('/api/health')
            ->assertStatus(503)
            ->assertJsonPath('error.code', 'database_unavailable');
    }
}
