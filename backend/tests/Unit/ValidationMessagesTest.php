<?php

namespace Tests\Unit;

use Illuminate\Support\Arr;
use PHPUnit\Framework\TestCase;

class ValidationMessagesTest extends TestCase
{
    public function test_spanish_has_a_text_for_every_rule_laravel_has_in_english(): void
    {
        // A Laravel update that adds a rule fails here until someone adds its Spanish text.
        $english = require __DIR__.'/../../vendor/laravel/framework/src/Illuminate/Translation/lang/en/validation.php';
        $spanish = require __DIR__.'/../../lang/es/validation.php';

        $keys = fn (array $messages) => array_keys(Arr::dot(Arr::except($messages, ['custom', 'attributes'])));

        $this->assertEqualsCanonicalizing($keys($english), $keys($spanish));
    }
}
