<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\RosterRecordFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** The department's one list of athletes. A removed athlete keeps the row with removed_at set (D16). */
#[Fillable(['student_number', 'name', 'institutional_email', 'sport', 'removed_at'])]
class RosterRecord extends Model
{
    /** @use HasFactory<RosterRecordFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['removed_at' => 'datetime'];
    }
}
