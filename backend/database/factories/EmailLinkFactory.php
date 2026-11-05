<?php

namespace Database\Factories;

use App\Models\EmailLink;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Athlete registration by default; each purpose sets exactly the owner columns it needs.
 *
 * @extends Factory<EmailLink>
 */
class EmailLinkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'purpose' => 'athlete_registration',
            'token_hash' => hash('sha256', fake()->unique()->uuid()),
            'roster_record_id' => RosterRecord::factory(),
            'user_id' => null,
            'staff_account_id' => null,
            'expires_at' => now()->addHour(),
        ];
    }

    public function athleteRegistration(): static
    {
        return $this->state([]);
    }

    public function athleteLink(): static
    {
        return $this->state(['purpose' => 'athlete_link', 'user_id' => User::factory()]);
    }

    public function staffInvite(): static
    {
        return $this->state(['purpose' => 'staff_invite', 'roster_record_id' => null, 'staff_account_id' => StaffAccount::factory()]);
    }
}
