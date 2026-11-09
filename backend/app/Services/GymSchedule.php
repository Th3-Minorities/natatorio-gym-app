<?php

namespace App\Services;

use App\Models\ScheduleSlot;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * When the gym is open, from the schedule slots: regular hours, special hours, athletes-only periods and closures.
 * Check In decides with it (REQ-F-83, G-28), and the dashboard shows the same answer on S-01 (#26).
 */
class GymSchedule
{
    /**
     * open, athletes_only (only athletes may Check In) or closed. A closure, or no open slot, closes the gym; an
     * athletes-only period opens it for athletes, also outside regular hours (G-28).
     */
    public function state(Carbon $now): string
    {
        if ($this->covering($now, 'closure') || ! $this->covering($now, 'regular_hours', 'special_hours', 'athletes_only')) {
            return 'closed';
        }

        return $this->covering($now, 'athletes_only') ? 'athletes_only' : 'open';
    }

    /**
     * The period of one of these types that includes now, if any.
     *
     * @return array{type: string, starts_at: Carbon, ends_at: Carbon}|null
     */
    public function covering(Carbon $now, string ...$types): ?array
    {
        return $this->periods($now)->first(
            fn ($p) => in_array($p['type'], $types, true) && $p['starts_at'] <= $now && $now < $p['ends_at']
        );
    }

    /**
     * Schedule slots as dated periods for today and tomorrow, enough to cover a 2-hour session.
     *
     * @return Collection<int, array{type: string, starts_at: Carbon, ends_at: Carbon}>
     */
    public function periods(Carbon $now): Collection
    {
        $days = [$now->copy()->startOfDay(), $now->copy()->addDay()->startOfDay()];

        $periods = ScheduleSlot::query()
            ->where(fn ($q) => $q->whereNotNull('weekday')->orWhere('ends_at', '>', $days[0]->copy()->setTimezone(config('app.timezone'))))
            ->get()
            ->flatMap(fn (ScheduleSlot $slot) => $slot->weekday === null
                ? [['type' => $slot->type, 'starts_at' => $slot->starts_at, 'ends_at' => $slot->ends_at]]
                : collect($days)->filter(fn (Carbon $day) => $day->dayOfWeek === (int) $slot->weekday)->map(fn (Carbon $day) => [
                    'type' => $slot->type,
                    'starts_at' => $day->copy()->setTimeFromTimeString($slot->start_time),
                    'ends_at' => $day->copy()->setTimeFromTimeString($slot->end_time),
                ])->values()->all());

        // On a day with special hours, they replace that day's regular hours (owner, 2026-11-07).
        $specialDays = $periods->where('type', 'special_hours')
            ->map(fn ($p) => $p['starts_at']->copy()->setTimezone(config('app.timezone'))->toDateString());

        return $periods->reject(fn ($p) => $p['type'] === 'regular_hours'
            && $specialDays->contains($p['starts_at']->copy()->setTimezone(config('app.timezone'))->toDateString()))->values();
    }
}
