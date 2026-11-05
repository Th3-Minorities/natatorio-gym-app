<?php

namespace Database\Factories;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\ImportedMembership;
use App\Models\RosterRecord;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Paid by default; athlete() and manual() set the source their type needs.
 *
 * @extends Factory<Authorization>
 */
class AuthorizationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'academic_term_id' => fn () => AcademicTerm::query()->value('id') ?? AcademicTerm::factory()->create()->id,
            'type' => 'paid',
            'status' => 'active',
            'imported_membership_id' => ImportedMembership::factory(),
            'roster_record_id' => null,
            'photo_path' => 'photos/'.fake()->uuid().'.jpg',
        ];
    }

    public function paid(?ImportedMembership $membership = null): static
    {
        return $this->state(fn () => [
            'type' => 'paid',
            'imported_membership_id' => $membership?->id ?? ImportedMembership::factory(),
            'roster_record_id' => null,
        ]);
    }

    public function athlete(?RosterRecord $record = null): static
    {
        return $this->state(fn () => [
            'type' => 'athlete',
            'imported_membership_id' => null,
            'roster_record_id' => $record?->id ?? RosterRecord::factory(),
        ]);
    }

    public function manual(): static
    {
        return $this->state([
            'type' => 'manual',
            'imported_membership_id' => null,
            'roster_record_id' => null,
            'reason' => 'Granted at the front desk after a payment check.',
        ]);
    }
}
