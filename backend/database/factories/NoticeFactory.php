<?php

namespace Database\Factories;

use App\Models\Notice;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Notice>
 */
class NoticeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'text_es' => fake()->sentence(),
            'text_en' => fake()->optional()->sentence(),
            'shown_from' => now(),
            'shown_until' => now()->addWeek(),
        ];
    }
}
