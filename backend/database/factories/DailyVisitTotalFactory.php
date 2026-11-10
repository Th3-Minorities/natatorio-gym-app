<?php

namespace Database\Factories;

use App\Models\DailyVisitTotal;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DailyVisitTotal>
 */
class DailyVisitTotalFactory extends Factory
{
    public function definition(): array
    {
        return [
            'day' => fake()->unique()->date(),
            'totals' => ['visits' => fake()->numberBetween(0, 200), 'busiest_hour' => fake()->numberBetween(6, 21)],
        ];
    }
}
