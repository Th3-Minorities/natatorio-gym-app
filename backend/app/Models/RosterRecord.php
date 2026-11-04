<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\RosterRecordFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One athlete on the department's list for a term. Claimed when an authorization points at it. */
#[Fillable(['academic_term_id', 'student_number', 'name', 'institutional_email', 'sport'])]
class RosterRecord extends Model
{
    /** @use HasFactory<RosterRecordFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    /** @return BelongsTo<AcademicTerm, $this> */
    public function academicTerm(): BelongsTo
    {
        return $this->belongsTo(AcademicTerm::class);
    }
}
