<?php

namespace Database\Factories;

use App\Models\EmailLink;
use App\Models\RosterRecord;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * An athlete registration link by default; athleteLink() for "I am an athlete" (signed in).
 *
 * @extends Factory<EmailLink>
 */
class EmailLinkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'purpose' => 'athlete_registration',
            'token_hash' => hash('sha256', Str::random(40)),
            'roster_record_id' => RosterRecord::factory(),
            'user_id' => null,
            'expires_at' => now()->addDay(),
        ];
    }

    public function athleteLink(): static
    {
        return $this->state(fn () => ['purpose' => 'athlete_link', 'user_id' => User::factory()]);
    }
}
