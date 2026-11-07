<?php

namespace Tests\Unit;

use App\Exceptions\ApiErrorRenderer;
use PHPUnit\Framework\TestCase;

class ErrorCodesTest extends TestCase
{
    public function test_every_error_code_is_snake_case_and_a_plain_string(): void
    {
        $codes = $this->codesThrownInTheApp();

        $this->assertNotEmpty($codes, 'Found no ApiException codes; the search below is broken.');

        foreach ([...array_values(ApiErrorRenderer::HTTP_CODES), ...$codes] as $code) {
            $this->assertMatchesRegularExpression('/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/', $code);
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
