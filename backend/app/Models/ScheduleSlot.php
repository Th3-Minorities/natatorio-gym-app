<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\ScheduleSlotFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** Weekly (weekday and local times) or dated (start and end), never both (decision D8). */
#[Fillable(['type', 'weekday', 'start_time', 'end_time', 'starts_at', 'ends_at', 'text_es', 'text_en'])]
class ScheduleSlot extends Model
{
    /** @use HasFactory<ScheduleSlotFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }
}
