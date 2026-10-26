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
        Route::prefix('api/test')->group(function () {
            Route::post('/validation', fn (Request $request) => $request->validate(['email' => ['required', 'email']]));
            Route::get('/api-exception', fn () => throw new ApiException('number_invalid', 422, 'Bad number.', ['field' => 'number']));
            Route::get('/crash', fn () => throw new \LogicException('secret internal detail'));
            Route::get('/forbidden', fn () => abort(403, 'secret internal detail'));
            Route::get('/throttled', fn () => 'ok')->middleware('throttle:1,1');
            Route::get('/unauthenticated', fn () => throw new AuthenticationException);
            Route::get('/own-response', fn () => throw new HttpResponseException(response()->json(['custom' => true], 418)));
            Route::get('/protected', fn () => 'ok')->middleware('auth');
            // A code nobody wrote a text for (the reviewer's example, dotted on purpose).
            Route::get('/code-without-text', fn () => throw new ApiException('check_in.location_denied', 422));
            Route::get('/server-code-without-text', fn () => throw new ApiException('printer_on_fire', 503));
        });
    }

    public function test_code_without_text_gets_a_readable_message_in_both_languages(): void
    {
        app()->setLocale('es');
        $this->getJson('/api/test/code-without-text')
            ->assertUnprocessable()
            ->assertExactJson(['error' => ['code' => 'check_in.location_denied', 'message' => 'No se pudo procesar la solicitud.']]);

        app()->setLocale('en');
        $this->getJson('/api/test/code-without-text')
            ->assertExactJson(['error' => ['code' => 'check_in.location_denied', 'message' => 'The request could not be processed.']]);
    }

    public function test_server_code_without_text_gets_the_server_error_message(): void
    {
        app()->setLocale('es');
        $this->getJson('/api/test/server-code-without-text')
            ->assertStatus(503)
            ->assertExactJson(['error' => ['code' => 'printer_on_fire', 'message' => 'Algo salió mal de nuestro lado. Intenta más tarde.']]);

        app()->setLocale('en');
        $this->getJson('/api/test/server-code-without-text')
            ->assertExactJson(['error' => ['code' => 'printer_on_fire', 'message' => 'Something went wrong on our side. Try again later.']]);
    }

    public function test_protected_route_without_json_header_answers_401(): void
    {
        // A browser link or curl sends no Accept header. There is no login page to redirect to.
        app()->setLocale('es');
        $this->get('/api/test/protected')
            ->assertUnauthorized()
            ->assertExactJson(['error' => ['code' => 'unauthenticated', 'message' => 'Inicia sesión para continuar.']]);
    }

    public function test_unauthenticated_uses_the_error_format(): void
    {
        $this->getJson('/api/test/unauthenticated')
            ->assertUnauthorized()
            ->assertExactJson(['error' => ['code' => 'unauthenticated', 'message' => __('errors.unauthenticated')]]);
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
