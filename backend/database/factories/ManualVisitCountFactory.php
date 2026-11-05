<?php

namespace Database\Factories;

use App\Models\ManualVisitCount;
use App\Models\StaffAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ManualVisitCount>
 */
class ManualVisitCountFactory extends Factory
{
    public function definition(): array
    {
        return [
            'starts_at' => now()->subHours(3),
            'ends_at' => now()->subHours(2),
            'visits' => fake()->numberBetween(1, 30),
            'entered_by_staff_account_id' => StaffAccount::factory(),
        ];
    }
}
