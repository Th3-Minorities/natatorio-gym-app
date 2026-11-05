<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WaiverAcceptance>
 */
class WaiverAcceptanceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'full_name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'emergency_contact_name' => fake()->name(),
            'emergency_contact_phone' => fake()->numerify('787-555-####'),
            'waiver_version' => '2026-11',
            'accepted_at' => now(),
        ];
    }
}
