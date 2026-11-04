<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\AuthorizationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Access for one User in one term: paid (an order), athlete (a roster record) or manual
 * (granted with a reason). One active per User and term (E-94).
 */
#[Fillable([
    'user_id', 'academic_term_id', 'type', 'status', 'imported_membership_id', 'roster_record_id',
    'photo_path', 'created_account', 'reason',
])]
class Authorization extends Model
{
    /** @use HasFactory<AuthorizationFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['created_account' => 'boolean'];
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
