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
        $person = FakePerson::make('upr.example');

        return [
            'student_number' => fake()->unique()->numerify('802######'),
            'name' => $person['name'],
            'institutional_email' => $person['email'],
            'sport' => fake()->randomElement(['Swimming', 'Volleyball', 'Basketball', 'Track']),
        ];
    }

    public function removed(): static
    {
        return $this->state(fn () => ['removed_at' => now()]);
    }
}
