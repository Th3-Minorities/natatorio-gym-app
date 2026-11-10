<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;

/**
 * Trusts the proxy header for the client IP only from the addresses in TRUSTED_PROXIES.
 * Empty means the address that connected to nginx is the client, as on a server with no
 * proxy in front. The list depends on CTI's answer to M-01 (architecture.md, gaps 5).
 */
class TrustProxies extends Middleware
{
    protected function proxies()
    {
        return config('app.trusted_proxies');
    }
}
