<?php

namespace Database\Factories;

use App\Models\AcademicTerm;
use App\Models\Import;
use App\Models\ImportedMembership;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Fake orders only, never real payment data.
 *
 * @extends Factory<ImportedMembership>
 */
class ImportedMembershipFactory extends Factory
{
    public function definition(): array
    {
        $person = FakePerson::make();

        return [
            'import_id' => Import::factory(),
            'academic_term_id' => fn () => AcademicTerm::query()->value('id') ?? AcademicTerm::factory()->create()->id,
            'order_reference' => 'WC-'.fake()->unique()->numerify('######'),
            'authorization_number' => fake()->unique()->bothify('#####?'),
            'name' => $person['name'],
            'email' => $person['email'],
            'membership_details' => 'Membresía semestral',
            'member_group' => fake()->randomElement(['student', 'employee']),
            'order_status' => 'completed',
            'paid_at' => now(),
            'synced_at' => now(),
        ];
    }
}
