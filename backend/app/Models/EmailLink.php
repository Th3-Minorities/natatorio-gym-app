<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\EmailLinkFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A single-use athlete link or in-person code. Only the hash is stored (D9). */
#[Fillable(['purpose', 'token_hash', 'roster_record_id', 'user_id', 'expires_at', 'used_at'])]
class EmailLink extends Model
{
    /** @use HasFactory<EmailLinkFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    /** @return BelongsTo<RosterRecord, $this> */
    public function rosterRecord(): BelongsTo
    {
        return $this->belongsTo(RosterRecord::class);
    }
}
