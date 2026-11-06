<?php

namespace Tests\Feature;

use App\Exceptions\ApiException;
use App\Http\Middleware\SelectAccountLocale;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class AccountLocaleTest extends TestCase
{
    public function test_guest_errors_are_spanish_regardless_of_device_language(): void
    {
        $this->withHeader('Accept-Language', 'en')->getJson('/api/missing')
            ->assertNotFound()
            ->assertExactJson(['error' => ['code' => 'not_found', 'message' => 'No encontramos lo que buscabas.']]);
    }

    public function test_error_renders_in_spanish_when_user_resolution_would_fail(): void
    {
        auth()->viaRequest('unavailable-user', fn () => throw new \RuntimeException('User storage unavailable.'));
        config([
            'auth.defaults.guard' => 'unavailable-user',
            'auth.guards.unavailable-user' => ['driver' => 'unavailable-user'],
        ]);
        app()->setLocale('en');

        $this->getJson('/api/missing')->assertNotFound()
            ->assertExactJson(['error' => ['code' => 'not_found', 'message' => 'No encontramos lo que buscabas.']]);
    }

    public function test_account_language_controls_api_errors_and_codes_stay_the_same(): void
    {
        foreach (['en', 'es'] as $locale) {
            $this->actingAs(new User(['locale' => $locale]));
            $messages = require lang_path($locale.'/errors.php');

            $this->getJson('/api/missing')->assertNotFound()
                ->assertExactJson(['error' => ['code' => 'not_found', 'message' => $messages['not_found']]]);
        }
    }

    public function test_api_middleware_selects_locale_before_feature_errors_are_created(): void
    {
        Route::middleware(['api', 'auth'])->get('/api/test-locale-feature', fn () => throw new ApiException('bad_request'));

        foreach (['en', 'es'] as $locale) {
            $this->actingAs(new User(['locale' => $locale]));
            $messages = require lang_path($locale.'/errors.php');
            $this->getJson('/api/test-locale-feature')->assertBadRequest()
                ->assertExactJson(['error' => ['code' => 'bad_request', 'message' => $messages['bad_request']]]);
        }
    }

    public function test_unsupported_account_locale_falls_back_to_spanish(): void
    {
        $this->actingAs(new User(['locale' => 'fr']));

        $this->getJson('/api/missing')->assertJsonPath('error.message', 'No encontramos lo que buscabas.');
    }

    public function test_each_staff_account_has_its_own_locale(): void
    {
        // Authentication will supply this resolver once staff sign in exists.
        foreach (['en', 'es'] as $locale) {
            $this->actingAs(new User(['locale' => $locale]));
            $request = Request::create('/api/test');
            $request->setUserResolver(fn () => new StaffAccount(['role' => 'staff', 'locale' => $locale]));

            (new SelectAccountLocale)->handle($request, function () use ($locale) {
                $this->assertSame($locale, app()->getLocale());

                return response()->json(['ok' => true]);
            });
        }
    }

    public function test_locale_is_reset_between_accounts_and_guests(): void
    {
        $this->actingAs(new User(['locale' => 'en']));
        $middleware = new SelectAccountLocale;
        $english = Request::create('/api/test');
        $english->setUserResolver(fn () => new User(['locale' => 'en']));
        $middleware->handle($english, fn () => response()->json([]));
        $this->assertSame('en', app()->getLocale());
        auth()->forgetUser();
        $guest = Request::create('/api/test');
        $guest->setUserResolver(fn () => null);
        $middleware->handle($guest, fn () => response()->json([]));

        $this->assertSame('es', app()->getLocale());
    }

    public function test_validation_error_keeps_the_stable_code_and_field_details(): void
    {
        Route::middleware('api')->post('/api/test-locale-validation', fn (Request $request) => $request->validate([
            'email' => ['required', 'email'],
        ]));

        foreach (['es', 'en'] as $locale) {
            $this->actingAs(new User(['locale' => $locale]));
            $messages = require lang_path($locale.'/errors.php');
            $this->postJson('/api/test-locale-validation', [])
                ->assertUnprocessable()
                ->assertJsonPath('error.code', 'validation_failed')
                ->assertJsonPath('error.message', $messages['validation_failed'])
                ->assertJsonStructure(['error' => ['code', 'message', 'details' => ['email']]]);
        }
    }
}
