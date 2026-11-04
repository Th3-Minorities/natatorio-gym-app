<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class LocaleTest extends TestCase
{
    public function test_a_missing_text_falls_back_to_spanish_not_english(): void
    {
        app('translator')->addLines(['sample.hello' => 'Hola'], 'es');
        app('translator')->addLines(['sample.bye' => 'Bye'], 'en');

        app()->setLocale('fr');

        $this->assertSame('es', config('app.fallback_locale'));
        $this->assertSame('Hola', __('sample.hello'));
        $this->assertSame('sample.bye', __('sample.bye'));
    }

    public function test_validation_messages_are_in_spanish_by_default(): void
    {
        Route::post('api/test/validation', fn (Request $request) => $request->validate(['email' => ['required', 'email']]));
        app()->setLocale('es');

        $this->postJson('/api/test/validation', [])
            ->assertUnprocessable()
            ->assertJsonPath('error.details.email.0', 'El campo email es obligatorio.');
    }

    public function test_validation_messages_stay_available_in_english(): void
    {
        Route::post('api/test/validation', fn (Request $request) => $request->validate(['email' => ['required', 'email']]));
        app()->setLocale('en');

        $this->postJson('/api/test/validation', [])
            ->assertJsonPath('error.details.email.0', 'The email field is required.');
    }
}
