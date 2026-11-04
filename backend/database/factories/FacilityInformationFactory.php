<?php

namespace Database\Factories;

use App\Models\FacilityInformation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FacilityInformation>
 */
class FacilityInformationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'topic' => fake()->randomElement(['rules', 'towel', 'footwear', 'machines', 'equipment']),
            'text_es' => fake()->paragraph(),
            'text_en' => fake()->optional()->paragraph(),
        ];
    }
}
