<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\ManualVisitCountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Visits by people without an account, counted from the paper log for a time block (E-132). */
#[Fillable(['starts_at', 'ends_at', 'visits', 'entered_by_staff_account_id'])]
class ManualVisitCount extends Model
{
    /** @use HasFactory<ManualVisitCountFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime'];
    }

    /** @return BelongsTo<StaffAccount, $this> */
    public function enteredBy(): BelongsTo
    {
        return $this->belongsTo(StaffAccount::class, 'entered_by_staff_account_id');
    }
}
