<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\AuthorizationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A User's right to use the gym in one term: paid, athlete or manual (REQ-F-19). */
#[Fillable([
    'user_id', 'academic_term_id', 'type', 'status', 'imported_membership_id', 'roster_record_id',
    'photo_path', 'photo_pending_at', 'created_account', 'reason',
])]
class Authorization extends Model
{
    /** @use HasFactory<AuthorizationFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['photo_pending_at' => 'datetime', 'created_account' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<AcademicTerm, $this> */
    public function academicTerm(): BelongsTo
    {
        return $this->belongsTo(AcademicTerm::class);
    }

    /** @return BelongsTo<ImportedMembership, $this> */
    public function importedMembership(): BelongsTo
    {
        return $this->belongsTo(ImportedMembership::class);
    }

    /** @return BelongsTo<RosterRecord, $this> */
    public function rosterRecord(): BelongsTo
    {
        return $this->belongsTo(RosterRecord::class);
    }
}
