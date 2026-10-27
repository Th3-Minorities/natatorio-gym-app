<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * An expected API error with a stable code the PWA can rely on.
 *
 * throw new ApiException('authorization_number_invalid', 422, __('registration.number_invalid'));
 */
class ApiException extends RuntimeException
{
    /**
     * @param  string  $errorCode  snake_case, never changes once released
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public readonly string $errorCode,
        public readonly int $status = 400,
        ?string $message = null,
        public readonly array $details = [],
    ) {
        parent::__construct($message ?? ApiErrorRenderer::message($errorCode, $status));
    }
}
