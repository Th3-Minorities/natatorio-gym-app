<?php

namespace Tests\Feature;

use App\Models\Concerns\SavesDatesInAppTimezone;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ModelDatesTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_utc_string_is_saved_as_puerto_rico_time(): void
    {
        // The API sends dates in UTC with a "Z" (api-conventions.md).
        $user = User::factory()->create(['email_verified_at' => '2026-10-27T01:00:00Z']);

        $this->assertSame('2026-10-26 21:00:00', $this->storedVerifiedAt($user));
        $this->assertSame('2026-10-27T01:00:00+00:00', $user->fresh()->email_verified_at->utc()->toIso8601String());
    }

    public function test_a_utc_carbon_is_saved_as_puerto_rico_time_and_is_not_changed(): void
    {
        $moment = Carbon::parse('2026-10-27 01:00:00', 'UTC');

        $user = User::factory()->create(['email_verified_at' => $moment]);

        $this->assertSame('2026-10-26 21:00:00', $this->storedVerifiedAt($user));
        $this->assertSame('UTC', $moment->getTimezone()->getName());
    }

    public function test_every_model_uses_the_trait(): void
    {
        $models = glob(app_path('Models/*.php'));

        $this->assertNotEmpty($models);

        foreach ($models as $file) {
            $class = 'App\\Models\\'.basename($file, '.php');

            $this->assertContains(SavesDatesInAppTimezone::class, class_uses_recursive($class), "{$class} must use SavesDatesInAppTimezone.");
        }
    }

    private function storedVerifiedAt(User $user): string
    {
        return DB::table('users')->where('id', $user->id)->value('email_verified_at');
    }
}
