<?php

namespace Database\Factories;

use App\Models\AcademicTerm;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * Terms never overlap, so each new one starts the day after the last one ends, whether that
 * one is saved already or only prepared in the same count(...) call.
 *
 * @extends Factory<AcademicTerm>
 */
class AcademicTermFactory extends Factory
{
    private static ?string $lastPreparedEnd = null;

    public function definition(): array
    {
        $lastEnd = max(array_filter([AcademicTerm::query()->max('ends_on'), self::$lastPreparedEnd]) ?: ['2026-08-14']);
        $startsOn = Carbon::parse($lastEnd)->addDay();
        $endsOn = $startsOn->copy()->addMonths(4);

        self::$lastPreparedEnd = $endsOn->toDateString();

        return [
            'name' => 'Term '.$startsOn->format('Y-m'),
            'starts_on' => $startsOn->toDateString(),
            'ends_on' => $endsOn->toDateString(),
        ];
    }
}
