<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\WaiverAcceptanceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The waiver accepted on screen, one per account. Its full_name is the User's name (D7). */
#[Fillable(['user_id', 'full_name', 'email', 'emergency_contact_name', 'emergency_contact_phone', 'accepted_at'])]
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
