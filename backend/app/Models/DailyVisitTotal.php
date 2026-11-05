<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\DailyVisitTotalFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** Counts for one America/Puerto_Rico day, no personal data, never deleted (D20). */
#[Fillable(['day', 'totals'])]
class DailyVisitTotal extends Model
{
    /** @use HasFactory<DailyVisitTotalFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected $primaryKey = 'day';

    protected $keyType = 'string';

    public $incrementing = false;

    protected function casts(): array
    {
        return ['totals' => 'array'];
    }
}
