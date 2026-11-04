<?php

namespace Database\Factories;

use App\Models\ScheduleSlot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Weekly regular hours by default; dated() for a closure.
 *
 * @extends Factory<ScheduleSlot>
 */
class ScheduleSlotFactory extends Factory
{
    public function definition(): array
    {
        return [
            'type' => 'regular_hours',
            'weekday' => fake()->numberBetween(0, 6),
            'start_time' => '06:00',
            'end_time' => '22:00',
        ];
    }

    public function dated(): static
    {
        return $this->state(fn () => [
            'type' => 'closure',
            'weekday' => null,
            'start_time' => null,
            'end_time' => null,
            'starts_at' => now()->addWeek()->startOfDay(),
            'ends_at' => now()->addWeek()->endOfDay(),
            'text_es' => 'Cerrado por mantenimiento.',
        ]);
    }
}
