<?php

namespace Tests\Feature;

use App\Exceptions\ApiException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiErrorFormatTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Routes that only exist in this test, to trigger each kind of error.
        Route::prefix('api/test')->group(function () {
            Route::post('/validation', fn (Request $request) => $request->validate(['email' => ['required', 'email']]));
            Route::get('/api-exception', fn () => throw new ApiException('number_invalid', 422, 'Bad number.', ['field' => 'number']));
            Route::get('/crash', fn () => throw new \LogicException('secret internal detail'));
            Route::get('/forbidden', fn () => abort(403, 'secret internal detail'));
            Route::get('/throttled', fn () => 'ok')->middleware('throttle:1,1');
        });
    }

    public function test_unknown_route_uses_the_error_format(): void
    {
        $this->getJson('/api/does-not-exist')
            ->assertNotFound()
            ->assertExactJson(['error' => ['code' => 'not_found', 'message' => __('errors.not_found')]]);
    }

    public function test_validation_errors_list_each_field(): void
    {
        $this->postJson('/api/test/validation', [])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation_failed')
            ->assertJsonStructure(['error' => ['code', 'message', 'details' => ['email']]]);
    }

    public function test_api_exception_keeps_its_own_code_message_and_details(): void
    {
        $this->getJson('/api/test/api-exception')
            ->assertUnprocessable()
            ->assertExactJson(['error' => [
                'code' => 'number_invalid',
                'message' => 'Bad number.',
                'details' => ['field' => 'number'],
            ]]);
    }

    public function test_wrong_method_answers_405(): void
    {
        $this->postJson('/api/health')
            ->assertMethodNotAllowed()
            ->assertJsonPath('error.code', 'method_not_allowed');
    }

    public function test_http_errors_hide_their_internal_message(): void
    {
        $this->getJson('/api/test/forbidden')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'forbidden')
            ->assertJsonMissingPath('error.debug')
            ->assertDontSee('secret internal detail');
    }

    public function test_too_many_requests_keeps_the_retry_header(): void
    {
        $this->getJson('/api/test/throttled')->assertOk();

        $this->getJson('/api/test/throttled')
            ->assertTooManyRequests()
            ->assertJsonPath('error.code', 'too_many_requests')
            ->assertHeader('Retry-After');
    }

    public function test_server_errors_hide_details_in_production(): void
    {
        config(['app.debug' => false]);

        $this->getJson('/api/test/crash')
            ->assertInternalServerError()
            ->assertExactJson(['error' => ['code' => 'server_error', 'message' => __('errors.server_error')]]);
    }

    public function test_server_errors_show_details_when_debugging(): void
    {
        config(['app.debug' => true]);

        $this->getJson('/api/test/crash')
            ->assertInternalServerError()
            ->assertJsonPath('error.code', 'server_error')
            ->assertJsonPath('error.debug.exception', \LogicException::class);
    }
}
