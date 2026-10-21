<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Turns any exception on an /api route into the one error format:
 * {"error": {"code": "...", "message": "...", "details": {...}}}
 */
class ApiErrorRenderer
{
    /** Stable codes for the HTTP errors Laravel raises by itself. */
    private const HTTP_CODES = [
        400 => 'bad_request',
        401 => 'unauthenticated',
        403 => 'forbidden',
        404 => 'not_found',
        405 => 'method_not_allowed',
        409 => 'conflict',
        413 => 'payload_too_large',
        419 => 'session_expired',
        422 => 'validation_failed',
        429 => 'too_many_requests',
        503 => 'service_unavailable',
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
                self::HTTP_CODES[$e->getStatusCode()] ?? ($e->getStatusCode() >= 500 ? 'server_error' : 'bad_request'),
                headers: $e->getHeaders(),
            ),
            default => self::response(500, 'server_error', debug: self::debug($e)),
        };
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
        $error = ['code' => $code, 'message' => $message ?? __('errors.'.$code)];

        if ($details !== []) {
            $error['details'] = $details;
        }

        if ($debug !== null) {
            $error['debug'] = $debug;
        }

        return new JsonResponse(['error' => $error], $status, $headers);
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
