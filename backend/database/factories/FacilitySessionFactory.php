<?php

namespace Database\Factories;

use App\Models\FacilitySession;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * An active manual-type session for a student member that starts now, with the times left to the database clock.
 * The states that need a known start or end send explicit times, two hours apart.
 *
 * @extends Factory<FacilitySession>
 */
class FacilitySessionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'authorization_type' => 'manual',
            'member_group' => 'student',
            'status' => 'active',
        ];
    }

    public function athlete(string $sport = 'Voleibol'): static
    {
        return $this->state(['authorization_type' => 'athlete', 'member_group' => null, 'sport' => $sport]);
    }

    public function paid(string $memberGroup = 'student'): static
    {
        return $this->state(['authorization_type' => 'paid', 'member_group' => $memberGroup]);
    }

    public function startedMinutesAgo(int $minutes): static
    {
        return $this->state(function () use ($minutes) {
            $startedAt = now()->subMinutes($minutes);

            return ['started_at' => $startedAt, 'ends_at' => $startedAt->copy()->addHours(2)];
        });
    }

    public function checkedOut(int $minutesIn = 30): static
    {
        return $this->ended('checked_out', $minutesIn);
    }

    public function endedEarly(int $minutesIn = 30): static
    {
        return $this->ended('ended_early', $minutesIn);
    }

    /** Ends $minutesIn after the start, which is 6 hours ago unless startedMinutesAgo() came first. */
    private function ended(string $status, int $minutesIn): static
    {
        return $this->state(function (array $attributes) use ($status, $minutesIn) {
            $startedAt = isset($attributes['started_at']) ? Carbon::parse($attributes['started_at']) : now()->subHours(6);

            return [
                'status' => $status,
                'started_at' => $startedAt,
                'ends_at' => $startedAt->copy()->addHours(2),
                'ended_at' => $startedAt->copy()->addMinutes($minutesIn),
            ];
        });
    }
}
