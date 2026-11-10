<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * An expected API error with a stable code the PWA can rely on.
 */
class ApiException extends RuntimeException
{
    /**
     * @param  string  $errorCode  snake_case, never changes once released
     * @param  array<string, mixed>  $details
     * @param  array<string, string>  $headers  for example Retry-After on a 429
     */
    public function __construct(
        public readonly string $errorCode,
        public readonly int $status = 400,
        public readonly array $details = [],
        public readonly array $headers = [],
    ) {
        parent::__construct();
    }
}
