<?php

namespace Tests\Concerns;

use Illuminate\Testing\TestResponse;

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

    /**
     * The next request sends the session cookie of $response, like a browser, and the sign-in
     * is read again from that session instead of from memory.
     */
    protected function keepingTheSessionOf(TestResponse $response): static
    {
        $this->app['auth']->forgetGuards();
        $cookie = config('session.cookie');

        return $this->fromThePwa()->withCookie($cookie, $response->getCookie($cookie)->getValue());
    }
}
