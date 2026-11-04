<?php

namespace Database\Factories;

use App\Models\AcademicTerm;
use App\Models\RosterRecord;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Fake athletes only, never a real roster.
 *
 * @extends Factory<RosterRecord>
 */
class RosterRecordFactory extends Factory
{
    public function definition(): array
    {
        return [
            'academic_term_id' => fn () => AcademicTerm::query()->value('id') ?? AcademicTerm::factory()->create()->id,
            'student_number' => '802'.fake()->unique()->numerify('######'),
            'name' => fake()->name(),
            'institutional_email' => fake()->unique()->userName().'@upr.edu',
            'sport' => fake()->randomElement(['Voleibol', 'Baloncesto', 'Atletismo', 'Natación', 'Béisbol']),
        ];
    }
}
