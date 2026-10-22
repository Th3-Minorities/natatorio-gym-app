<?php

namespace Tests\Unit;

use App\Exceptions\ApiErrorRenderer;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

class ErrorMessagesTest extends TestCase
{
    public function test_english_and_spanish_have_the_same_error_codes(): void
    {
        $english = array_keys(require __DIR__.'/../../lang/en/errors.php');
        $spanish = array_keys(require __DIR__.'/../../lang/es/errors.php');

        sort($english);
        sort($spanish);

        $this->assertSame($english, $spanish);
    }

    public function test_every_code_the_renderer_uses_has_a_message(): void
    {
        $messages = require __DIR__.'/../../lang/en/errors.php';
        $codes = [...array_values((new ReflectionClass(ApiErrorRenderer::class))->getConstant('HTTP_CODES')), 'server_error'];

        foreach ($codes as $code) {
            $this->assertArrayHasKey($code, $messages, "lang/en/errors.php has no message for \"{$code}\".");
        }
    }
}
