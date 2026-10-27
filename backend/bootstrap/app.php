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
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Expected errors with a stable code are part of the API, not bugs.
        $exceptions->dontReport(ApiException::class);

        // Every /api response uses one error format (docs/design/api-conventions.md).
        $exceptions->render(fn (Throwable $e, Request $request) => $request->is('api', 'api/*')
            ? ApiErrorRenderer::render($e)
            : null);
    })->create();
