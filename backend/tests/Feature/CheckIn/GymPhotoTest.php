<?php

namespace Tests\Feature\CheckIn;

use App\Models\Authorization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class GymPhotoTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    public function test_photo_requires_a_user_sign_in(): void
    {
        $this->fromThePwa()->getJson('/api/user/photo')->assertUnauthorized();
    }

    public function test_photo_is_private_and_always_belongs_to_the_signed_in_user(): void
    {
        Storage::fake('local');
        $user = User::factory()->create(['current_session_id' => 'device']);
        $authorization = Authorization::factory()->manual()->create(['user_id' => $user->id, 'photo_path' => 'photos/own.jpg']);
        Authorization::factory()->manual()->create(['photo_path' => 'photos/other.jpg']);
        Storage::disk('local')->put($authorization->photo_path, 'own-photo');
        Storage::disk('local')->put('photos/other.jpg', 'other-photo');
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa();

        $response = $this->get('/api/user/photo?user_id=999')->assertOk();
        $this->assertSame('own-photo', $response->streamedContent());
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
    }

    public function test_missing_photo_returns_the_existing_not_found_code(): void
    {
        $user = User::factory()->create(['current_session_id' => 'device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa()
            ->getJson('/api/user/photo')->assertNotFound()->assertJsonPath('error.code', 'not_found');
    }
}
