<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SelectAccountLocale
{
    public static function apply(Request $request): void
    {
        $locale = auth()->hasUser() ? $request->user()?->locale : null;
        app()->setLocale(in_array($locale, ['es', 'en'], true) ? $locale : 'es');
    }

    public function handle(Request $request, Closure $next): Response
    {
        self::apply($request);

        return $next($request);
    }
}
