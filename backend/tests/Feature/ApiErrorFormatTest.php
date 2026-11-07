<?php

namespace Tests\Feature;

use App\Exceptions\ApiException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiErrorFormatTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Routes that only exist in this test, to trigger each kind of error.
        Route::prefix('api/test')->middleware('api')->group(function () {
            Route::post('/validation', fn (Request $request) => $request->validate(['email' => ['required', 'email']]));
            Route::post('/validation-rules', fn (Request $request) => $request->validate([
                'email' => ['required', 'email', 'max:8'],
                'name' => ['required', 'starts_with:A'],
            ]));
            Route::get('/api-exception', fn () => throw new ApiException('number_invalid', 422, ['field' => 'number']));
            Route::get('/crash', fn () => throw new \LogicException('secret internal detail'));
            Route::get('/forbidden', fn () => abort(403, 'secret internal detail'));
            Route::get('/throttled', fn () => 'ok')->middleware('throttle:1,1');
            Route::get('/unauthenticated', fn () => throw new AuthenticationException);
            Route::get('/own-response', fn () => throw new HttpResponseException(response()->json(['custom' => true], 418)));
            Route::get('/protected', fn () => 'ok')->middleware('auth');
            Route::get('/unknown-client-status', fn () => abort(418, 'secret internal detail'));
            Route::get('/unknown-server-status', fn () => abort(507, 'secret internal detail'));
        });
    }

    public function test_unknown_client_status_uses_bad_request_code(): void
    {
        $this->getJson('/api/test/unknown-client-status')
            ->assertStatus(418)
            ->assertExactJson(['error' => ['code' => 'bad_request']]);
    }

    public function test_unknown_server_status_uses_server_error_code(): void
    {
        $this->getJson('/api/test/unknown-server-status')
            ->assertStatus(507)
            ->assertExactJson(['error' => ['code' => 'server_error']]);
    }

    public function test_protected_route_without_json_header_answers_401(): void
    {
        // A browser link or curl sends no Accept header. There is no login page to redirect to.
        $this->get('/api/test/protected')
            ->assertUnauthorized()
            ->assertExactJson(['error' => ['code' => 'unauthenticated']]);
    }

    public function test_unauthenticated_uses_the_error_format(): void
    {
        $this->getJson('/api/test/unauthenticated')
            ->assertUnauthorized()
            ->assertExactJson(['error' => ['code' => 'unauthenticated']]);
    }

    public function test_a_response_built_on_purpose_is_sent_as_it_is(): void
    {
        $this->getJson('/api/test/own-response')
            ->assertStatus(418)
            ->assertExactJson(['custom' => true]);
    }

    public function test_unknown_route_uses_the_error_format(): void
    {
        $this->getJson('/api/does-not-exist')
            ->assertNotFound()
            ->assertExactJson(['error' => ['code' => 'not_found']]);
    }

    public function test_validation_errors_list_each_field(): void
    {
        $this->postJson('/api/test/validation', [])
            ->assertUnprocessable()
            ->assertExactJson(['error' => [
                'code' => 'validation_failed',
                'details' => ['email' => ['required']],
            ]]);
    }

    public function test_validation_details_are_failed_rule_names_in_snake_case(): void
    {
        $this->postJson('/api/test/validation-rules', ['email' => 'not-an-email', 'name' => 'Bob'])
            ->assertUnprocessable()
            ->assertExactJson(['error' => [
                'code' => 'validation_failed',
                'details' => ['email' => ['email', 'max'], 'name' => ['starts_with']],
            ]]);
    }

    public function test_api_exception_keeps_its_own_code_and_details(): void
    {
        $this->getJson('/api/test/api-exception')
            ->assertUnprocessable()
            ->assertExactJson(['error' => [
                'code' => 'number_invalid',
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
            ->assertJsonMissingPath('error.message')
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
            ->assertExactJson(['error' => ['code' => 'server_error']]);
    }

    public function test_server_errors_show_details_when_debugging(): void
    {
        config(['app.debug' => true]);

        $this->getJson('/api/test/crash')
            ->assertInternalServerError()
            ->assertJsonPath('error.code', 'server_error')
            ->assertJsonMissingPath('error.message')
            ->assertJsonPath('error.debug.exception', \LogicException::class);
    }
}
