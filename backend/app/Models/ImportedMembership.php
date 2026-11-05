<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\ImportedMembershipFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A copy of one WooCommerce order. Claimed when an authorization points at it. */
#[Fillable([
    'import_id', 'academic_term_id', 'order_reference', 'authorization_number', 'name', 'email',
    'member_group', 'membership_details', 'order_status', 'paid_at', 'synced_at',
])]
class ImportedMembership extends Model
{
    /** @use HasFactory<ImportedMembershipFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['paid_at' => 'datetime', 'synced_at' => 'datetime'];
    }

    /** @return BelongsTo<Import, $this> */
    public function import(): BelongsTo
    {
        return $this->belongsTo(Import::class);
    }

    /** @return BelongsTo<AcademicTerm, $this> */
    public function academicTerm(): BelongsTo
    {
        return $this->belongsTo(AcademicTerm::class);
    }
}
