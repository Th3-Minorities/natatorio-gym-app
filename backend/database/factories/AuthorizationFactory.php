<?php

namespace Database\Factories;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\ImportedMembership;
use App\Models\RosterRecord;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * A paid authorization by default, in the term of its order. athlete() and manual() for the
 * other types. The source always matches the type (data-model.md section 5).
 *
 * @extends Factory<Authorization>
 */
class AuthorizationFactory extends Factory
{
    public function definition(): array
    {
        // Laravel fills attributes in this order, so the sources exist before the term is read from them.
        return [
            'imported_membership_id' => ImportedMembership::factory(),
            'roster_record_id' => null,
            'user_id' => User::factory(),
            'academic_term_id' => fn (array $attributes) => $this->termOfSource($attributes),
            'type' => 'paid',
            'status' => 'active',
            'photo_path' => 'photos/'.fake()->uuid().'.jpg',
        ];
    }

    public function athlete(): static
    {
        return $this->state(fn () => [
            'type' => 'athlete',
            'imported_membership_id' => null,
            'roster_record_id' => RosterRecord::factory(),
        ]);
    }

    public function manual(): static
    {
        return $this->state(fn () => [
            'type' => 'manual',
            'imported_membership_id' => null,
            'roster_record_id' => null,
            'academic_term_id' => fn () => AcademicTerm::query()->value('id') ?? AcademicTerm::factory()->create()->id,
            'photo_path' => null,
            'reason' => 'Orden con error, recibo verificado en la oficina.',
        ]);
    }

    /** @param array<string, mixed> $attributes */
    private function termOfSource(array $attributes): int
    {
        if ($attributes['imported_membership_id']) {
            return ImportedMembership::findOrFail($attributes['imported_membership_id'])->academic_term_id;
        }

        if ($attributes['roster_record_id']) {
            return RosterRecord::findOrFail($attributes['roster_record_id'])->academic_term_id;
        }

        return AcademicTerm::query()->value('id') ?? AcademicTerm::factory()->create()->id;
    }
}
