<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\WaiverAcceptanceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The waiver a User accepted, with the version of its text (E-134). One per account. */
#[Fillable([
    'user_id', 'full_name', 'email', 'emergency_contact_name', 'emergency_contact_phone', 'waiver_version', 'accepted_at',
])]
class WaiverAcceptance extends Model
{
    /** @use HasFactory<WaiverAcceptanceFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
