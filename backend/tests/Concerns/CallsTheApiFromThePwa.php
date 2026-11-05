<?php

namespace Tests\Concerns;

/**
 * Sanctum starts a cookie session only for requests from the PWA's own origin
 * (config/sanctum.php, stateful). Tests that sign in must send that origin.
 */
trait CallsTheApiFromThePwa
{
    protected function fromThePwa(): static
    {
        return $this->withHeaders(['Origin' => 'http://localhost', 'Accept' => 'application/json']);
    }
}
