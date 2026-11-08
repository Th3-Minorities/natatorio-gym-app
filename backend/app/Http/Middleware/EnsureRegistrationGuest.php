<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureRegistrationGuest
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::guard('staff')->check() || Auth::guard('web')->check()) {
            throw new ApiException('forbidden', 403);
        }

        return $next($request);
    }
}
