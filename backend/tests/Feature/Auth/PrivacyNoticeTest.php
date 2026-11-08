<?php

namespace Tests\Feature\Auth;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class PrivacyNoticeTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    public function test_a_guest_reads_the_notice_without_starting_the_registration_step(): void
    {
        $response = $this->fromThePwa()->getJson('/api/privacy')->assertOk()
            ->assertJsonPath('version', 'draft')->assertJsonPath('draft', true)
            ->assertSessionMissing('registration_privacy_shown');
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_a_signed_in_user_gets_the_same_notice_and_no_session_key(): void
    {
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa();

        $this->getJson('/api/privacy')->assertOk()->assertJsonPath('version', 'draft')->assertJsonPath('draft', true)
            ->assertSessionMissing('registration_privacy_shown')->assertSessionMissing('registration_privacy_accepted');
    }

    public function test_it_returns_exactly_what_the_registration_step_returns(): void
    {
        Setting::query()->create(['name' => 'contact_phone', 'value' => '787-555-0199']);
        config(['registration.privacy_version' => '2026-12-01']);

        $public = $this->fromThePwa()->getJson('/api/privacy')->assertOk()->assertJsonPath('draft', false);
        $registration = $this->getJson('/api/user/registration/privacy')->assertOk()->assertSessionHas('registration_privacy_shown', '2026-12-01');

        $this->assertSame($registration->json(), $public->json());
        $this->assertSame('2026-12-01', $public->json('version'));
        $this->assertSame('787-555-0199', $public->json('contact_number'));
    }

    public function test_only_reading_is_allowed(): void
    {
        $this->fromThePwa()->postJson('/api/privacy', ['version' => 'draft'])
            ->assertStatus(405)->assertJsonPath('error.code', 'method_not_allowed');
    }
}
