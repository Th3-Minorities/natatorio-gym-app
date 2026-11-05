<?php

namespace Database\Factories;

use App\Models\Setting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Setting>
 */
class SettingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->slug(2),
            'value' => fake()->numerify('787-555-####'),
        ];
    }
}
