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

    public function test_every_code_thrown_in_the_app_is_snake_case_with_both_texts(): void
    {
        $english = require __DIR__.'/../../lang/en/errors.php';
        $spanish = require __DIR__.'/../../lang/es/errors.php';
        $codes = $this->codesThrownInTheApp();

        $this->assertNotEmpty($codes, 'Found no ApiException codes; the search below is broken.');

        foreach ($codes as $code) {
            $this->assertMatchesRegularExpression('/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/', $code, "\"{$code}\" is not snake_case (docs/design/api-conventions.md).");
            $this->assertArrayHasKey($code, $english, "lang/en/errors.php has no message for \"{$code}\".");
            $this->assertArrayHasKey($code, $spanish, "lang/es/errors.php has no message for \"{$code}\".");
        }
    }

    /** @return list<string> Every code passed to `new ApiException(...)` in app/, routes/ and bootstrap/. */
    private function codesThrownInTheApp(): array
    {
        $codes = [];

        foreach (['app', 'routes', 'bootstrap'] as $folder) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator(__DIR__.'/../../'.$folder, \FilesystemIterator::SKIP_DOTS),
            );

            foreach ($files as $file) {
                if ($file->getExtension() === 'php') {
                    array_push($codes, ...$this->codesIn((string) file_get_contents($file->getPathname()), $file->getPathname()));
                }
            }
        }

        return array_values(array_unique($codes));
    }

    /**
     * Reads the file with PHP's own parser, so comments, line breaks, both quote styles
     * and the named argument `errorCode:` are handled. Short or full class names both count.
     *
     * @return list<string>
     */
    private function codesIn(string $source, string $path): array
    {
        $tokens = array_values(array_filter(
            token_get_all($source),
            fn ($token) => ! is_array($token) || ! in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true),
        ));
        $codes = [];

        foreach ($tokens as $i => $token) {
            $class = $tokens[$i + 1] ?? null;

            if (! is_array($token) || $token[0] !== T_NEW || ! is_array($class)
                || ! preg_match('/(^|\\\\)ApiException$/', $class[1]) || ($tokens[$i + 2] ?? null) !== '(') {
                continue;
            }

            $argument = $i + 3;

            if (is_array($tokens[$argument]) && $tokens[$argument][1] === 'errorCode' && $tokens[$argument + 1] === ':') {
                $argument += 2;
            }

            $this->assertTrue(
                is_array($tokens[$argument]) && $tokens[$argument][0] === T_CONSTANT_ENCAPSED_STRING,
                "{$path}:{$class[2]}: pass the error code as the first argument, as a plain string, so this test can check it.",
            );

            $codes[] = substr($tokens[$argument][1], 1, -1);
        }

        return $codes;
    }
}
