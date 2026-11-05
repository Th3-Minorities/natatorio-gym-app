<?php

namespace Database\Factories;

use App\Models\RosterRecord;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Fake athletes only, never real student data.
 *
 * @extends Factory<RosterRecord>
 */
class RosterRecordFactory extends Factory
{
    public function definition(): array
    {
        return [
            'student_number' => fake()->unique()->numerify('802-##-####'),
            'name' => fake()->name(),
            'institutional_email' => fake()->unique()->userName().'@upr.example',
            'sport' => fake()->randomElement(['Swimming', 'Volleyball', 'Basketball', 'Track']),
        ];
    }

    public function removed(): static
    {
        return $this->state(fn () => ['removed_at' => now()]);
    }
}
