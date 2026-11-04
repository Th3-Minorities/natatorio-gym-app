<?php

use App\Exceptions\ApiErrorRenderer;
use App\Exceptions\ApiException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The API has no login page, so guests get a 401 instead of a redirect to route('login').
        $middleware->redirectGuestsTo(fn () => null);

        // Behind the nginx proxy and the phone tunnel (later also a CTI proxy), the connection Laravel
        // sees is the proxy's. Believe X-Forwarded-For and -Proto from private addresses only (the
        // Docker network and the host), so the API gets the visitor's real IP (audit log, attempt
        // limits) and builds https links. Laravel takes the first address from the right that is not
        // private, so a visitor cannot invent their IP by sending the header. A CTI proxy on a public
        // address must be added here (architecture.md, gap 5). X-Forwarded-Host is not believed: it
        // would let a visitor choose the host of the links in emails.
        $middleware->trustProxies(
            at: ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
            headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Expected errors with a stable code are part of the API, not bugs. A server error thrown
        // on purpose (5xx) is still a failure someone must see in the logs.
        $exceptions->dontReportWhen(fn (Throwable $e) => $e instanceof ApiException && $e->status < 500);

        // Every /api response uses one error format (docs/design/api-conventions.md).
        $exceptions->render(fn (Throwable $e, Request $request) => $request->is('api', 'api/*')
            ? ApiErrorRenderer::render($e)
            : null);
    })->create();
