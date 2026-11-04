<?php

namespace Tests\Unit;

use App\Exceptions\ApiErrorRenderer;
use PHPUnit\Framework\AssertionFailedError;
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

    // The tests below check the search itself, with small pieces of code that hide a code in the ways
    // the app code does not (yet): a renamed import, a subclass, a helper call.

    public function test_the_search_finds_a_code_thrown_through_a_renamed_import(): void
    {
        $source = '<?php use App\Exceptions\ApiException as Boom; throw new Boom(\'renamed_code\', 422);';

        $this->assertSame(['renamed_code'], $this->codesInSources([$source]));
    }

    public function test_the_search_finds_a_code_given_by_a_subclass(): void
    {
        $subclass = '<?php class OutOfStock extends ApiException { public function __construct() { parent::__construct(\'out_of_stock\', 409); } }';
        $chained = '<?php class NoStockLeft extends OutOfStock {}';
        $throws = '<?php throw new OutOfStock; throw new NoStockLeft;';

        $this->assertSame(['out_of_stock'], $this->codesInSources([$subclass, $chained, $throws]));
    }

    public function test_the_search_reads_the_code_of_a_subclass_without_its_own_constructor(): void
    {
        $subclass = '<?php class Locked extends ApiException {}';
        $throws = '<?php throw new Locked(\'locked_code\', 423);';

        $this->assertSame(['locked_code'], $this->codesInSources([$subclass, $throws]));
    }

    public function test_the_search_finds_a_code_given_to_a_throw_helper(): void
    {
        $source = '<?php throw_if($full, \App\Exceptions\ApiException::class, \'helper_code\', 409); throw_unless($ok, ApiException::class, \'other_code\');';

        $this->assertSame(['helper_code', 'other_code'], $this->codesInSources([$source]));
    }

    public function test_the_search_refuses_a_helper_that_hides_the_code_in_a_variable(): void
    {
        $this->expectException(AssertionFailedError::class);

        $this->codesInSources(['<?php function fail(string $code) { throw new ApiException($code, 422); }']);
    }

    public function test_the_search_refuses_a_subclass_that_hides_the_code_in_a_variable(): void
    {
        $this->expectException(AssertionFailedError::class);

        $this->codesInSources(['<?php class Custom extends ApiException { public function __construct(string $code) { parent::__construct($code); } }']);
    }

    /** @return list<string> Every code passed to ApiException (or a subclass) in app/, routes/ and bootstrap/. */
    private function codesThrownInTheApp(): array
    {
        $sources = [];

        foreach (['app', 'routes', 'bootstrap'] as $folder) {
            $files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator(__DIR__.'/../../'.$folder, \FilesystemIterator::SKIP_DOTS),
            );

            foreach ($files as $file) {
                if ($file->getExtension() === 'php') {
                    $sources[$file->getPathname()] = (string) file_get_contents($file->getPathname());
                }
            }
        }

        return $this->codesInSources($sources);
    }

    /**
     * @param  array<string, string>|list<string>  $sources  PHP code by file path
     * @return list<string>
     */
    private function codesInSources(array $sources): array
    {
        $classes = $this->apiExceptionClasses($sources);
        $codes = [];

        foreach ($sources as $path => $source) {
            array_push($codes, ...$this->codesIn($source, (string) $path, $classes));
        }

        return array_values(array_unique($codes));
    }

    /**
     * ApiException and every class that extends it, even through other subclasses.
     *
     * @param  array<string, string>|list<string>  $sources
     * @return array<string, bool> lowercase class name => the class has its own constructor
     */
    private function apiExceptionClasses(array $sources): array
    {
        $classes = ['apiexception' => false];

        do {
            $found = false;

            foreach ($sources as $source) {
                $tokens = $this->tokens($source);
                $ownConstructor = $this->definesConstructor($tokens);

                foreach ($tokens as $i => $token) {
                    $class = $tokens[$i + 1] ?? null;
                    $parent = $tokens[$i + 3] ?? null;

                    if (! is_array($token) || $token[0] !== T_CLASS || ! is_array($class) || ($tokens[$i + 2][0] ?? null) !== T_EXTENDS
                        || ! is_array($parent) || ! isset($classes[$this->shortName($parent[1])]) || isset($classes[$this->shortName($class[1])])) {
                        continue;
                    }

                    $classes[$this->shortName($class[1])] = $ownConstructor || $classes[$this->shortName($parent[1])];
                    $found = true;
                }
            }
        } while ($found);

        return $classes;
    }

    /**
     * Reads the file with PHP's own parser, so comments, line breaks, both quote styles
     * and the named argument `errorCode:` are handled. Short or full class names both count,
     * and so do a renamed import (`use ... as Boom`), a subclass, and a throw helper
     * (`throw_if($condition, ApiException::class, 'code')`).
     *
     * @param  array<string, bool>  $classes  from apiExceptionClasses()
     * @return list<string>
     */
    private function codesIn(string $source, string $path, array $classes): array
    {
        $tokens = $this->tokens($source);
        $codes = [];
        $extendsApiException = false;

        foreach ($tokens as $i => $token) {
            $next = $tokens[$i + 1] ?? null;

            if (is_array($token) && $token[0] === T_USE && is_array($next) && is_array($tokens[$i + 3] ?? null)
                && ($tokens[$i + 2][0] ?? null) === T_AS && isset($classes[$this->shortName($next[1])])) {
                $classes[$this->shortName($tokens[$i + 3][1])] = $classes[$this->shortName($next[1])];
            }

            if (is_array($token) && $token[0] === T_EXTENDS && is_array($next) && isset($classes[$this->shortName($next[1])])) {
                $extendsApiException = true;
            }
        }

        foreach ($tokens as $i => $token) {
            $next = $tokens[$i + 1] ?? null;
            $argument = null;

            if (! is_array($token)) {
                continue;
            }

            if ($token[0] === T_NEW && is_array($next) && isset($classes[$this->shortName($next[1])]) && ($tokens[$i + 2] ?? null) === '(') {
                // A subclass with its own constructor gets its code from parent::__construct() below.
                $argument = $classes[$this->shortName($next[1])] ? null : $i + 3;
            } elseif (isset($classes[$this->shortName($token[1])]) && ($next[0] ?? null) === T_DOUBLE_COLON
                && ($tokens[$i + 2][0] ?? null) === T_CLASS && ($tokens[$i + 3] ?? null) === ',') {
                $argument = $i + 4;
            } elseif ($extendsApiException && strtolower($token[1]) === 'parent' && ($next[0] ?? null) === T_DOUBLE_COLON
                && ($tokens[$i + 2][1] ?? null) === '__construct' && ($tokens[$i + 3] ?? null) === '(') {
                $argument = $i + 4;
            }

            if ($argument === null) {
                continue;
            }

            if (is_array($tokens[$argument]) && $tokens[$argument][1] === 'errorCode' && $tokens[$argument + 1] === ':') {
                $argument += 2;
            }

            $this->assertTrue(
                is_array($tokens[$argument]) && $tokens[$argument][0] === T_CONSTANT_ENCAPSED_STRING,
                "{$path}:{$token[2]}: pass the error code as the first argument, as a plain string, so this test can check it.",
            );

            $codes[] = substr($tokens[$argument][1], 1, -1);
        }

        return $codes;
    }

    /** @return list<array{int, string, int}|string> the tokens without spaces and comments */
    private function tokens(string $source): array
    {
        return array_values(array_filter(
            token_get_all($source),
            fn ($token) => ! is_array($token) || ! in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true),
        ));
    }

    /** @param  list<array{int, string, int}|string>  $tokens */
    private function definesConstructor(array $tokens): bool
    {
        foreach ($tokens as $i => $token) {
            if (is_array($token) && $token[0] === T_FUNCTION && ($tokens[$i + 1][1] ?? null) === '__construct') {
                return true;
            }
        }

        return false;
    }

    /** `\App\Exceptions\ApiException` becomes `apiexception`. */
    private function shortName(string $name): string
    {
        return strtolower(substr(strrchr('\\'.$name, '\\'), 1));
    }
}
