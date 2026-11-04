<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Turns any exception on an /api route into the one error format:
 * {"error": {"code": "...", "message": "...", "details": {...}}}
 */
class ApiErrorRenderer
{
    /**
     * Stable codes for the HTTP errors Laravel raises by itself, each with its own text.
     * Any other status gets its own code from its standard name (415 is `unsupported_media_type`), see codeFor().
     */
    private const HTTP_CODES = [
        400 => 'bad_request',
        401 => 'unauthenticated',
        403 => 'forbidden',
        404 => 'not_found',
        405 => 'method_not_allowed',
        409 => 'conflict',
        410 => 'gone',
        413 => 'payload_too_large',
        419 => 'session_expired',
        422 => 'validation_failed',
        429 => 'too_many_requests',
        500 => 'server_error',
        502 => 'bad_gateway',
        503 => 'service_unavailable',
        504 => 'gateway_timeout',
    ];

    public static function render(Throwable $e): ?JsonResponse
    {
        return match (true) {
            // A response built on purpose is sent as it is.
            $e instanceof HttpResponseException => null,
            $e instanceof ApiException => self::response($e->status, $e->errorCode, $e->getMessage(), $e->details),
            $e instanceof ValidationException => self::response($e->status, 'validation_failed', null, $e->errors()),
            $e instanceof AuthenticationException => self::response(401, 'unauthenticated'),
            $e instanceof HttpExceptionInterface => self::response(
                $e->getStatusCode(),
                self::codeFor($e->getStatusCode()),
                headers: $e->getHeaders(),
            ),
            default => self::response(500, 'server_error', debug: self::debug($e)),
        };
    }

    /** One code per HTTP status: the listed one, else the standard name of the status. */
    private static function codeFor(int $status): string
    {
        if (isset(self::HTTP_CODES[$status])) {
            return self::HTTP_CODES[$status];
        }

        return isset(Response::$statusTexts[$status])
            ? Str::slug(Response::$statusTexts[$status], '_')
            : ($status >= 500 ? 'server_error' : 'bad_request');
    }

    /**
     * @param  array<string, mixed>  $details
     * @param  array<string, string>  $headers
     * @param  array<string, mixed>|null  $debug
     */
    private static function response(
        int $status,
        string $code,
        ?string $message = null,
        array $details = [],
        array $headers = [],
        ?array $debug = null,
    ): JsonResponse {
        $error = ['code' => $code, 'message' => $message ?? self::message($code, $status)];

        if ($details !== []) {
            $error['details'] = $details;
        }

        if ($debug !== null) {
            $error['debug'] = $debug;
        }

        return new JsonResponse(['error' => $error], $status, $headers);
    }

    /**
     * The text for a code, from lang/<locale>/errors.php. A code with no text gets a general
     * one instead of the raw key "errors.<code>": the server error text for 5xx, else bad_request.
     */
    public static function message(string $code, int $status): string
    {
        if (Lang::has('errors.'.$code)) {
            return __('errors.'.$code);
        }

        return __($status >= 500 ? 'errors.server_error' : 'errors.bad_request');
    }

    /** Only with APP_DEBUG on, so production never shows internals. */
    private static function debug(Throwable $e): ?array
    {
        if (! config('app.debug')) {
            return null;
        }

        return [
            'exception' => $e::class,
            'message' => $e->getMessage(),
            'file' => $e->getFile().':'.$e->getLine(),
        ];
    }
}
