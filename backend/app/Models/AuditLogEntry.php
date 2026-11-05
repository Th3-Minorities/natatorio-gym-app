<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\AuditLogEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Who did what and when. The affected record is subject_table plus subject_id, with no foreign key. */
#[Fillable([
    'staff_account_id', 'occurred_at', 'ip_address', 'user_agent', 'action', 'subject_table', 'subject_id',
    'before_values', 'after_values', 'reason',
])]
class AuditLogEntry extends Model
{
    /** @use HasFactory<AuditLogEntryFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected static function booted(): void
    {
        // Nothing in the app edits or deletes an entry (E-108). Only the 5-year retention job (#71)
        // removes entries, with a query delete that does not go through these model events.
        static::updating(fn () => throw new LogicException('Audit log entries cannot be edited.'));
        static::deleting(fn () => throw new LogicException('Audit log entries cannot be deleted.'));
    }

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime', 'before_values' => 'array', 'after_values' => 'array'];
    }

    /** @return BelongsTo<StaffAccount, $this> */
    public function staffAccount(): BelongsTo
    {
        return $this->belongsTo(StaffAccount::class);
    }
}
