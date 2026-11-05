<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\EmailLinkFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A single-use link sent by email. Only the hash of its token is stored (D9). */
#[Fillable(['purpose', 'token_hash', 'roster_record_id', 'user_id', 'staff_account_id', 'expires_at', 'used_at'])]
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

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<StaffAccount, $this> */
    public function staffAccount(): BelongsTo
    {
        return $this->belongsTo(StaffAccount::class);
    }
}
