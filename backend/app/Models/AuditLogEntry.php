<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\AuditLogEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One change made by a staff account, or a system alert (REQ-NF-39). */
#[Fillable([
    'staff_account_id', 'occurred_at', 'ip_address', 'user_agent', 'action',
    'subject_table', 'subject_id', 'before_values', 'after_values', 'reason',
])]
class AuditLogEntry extends Model
{
    /** @use HasFactory<AuditLogEntryFactory> */
    use HasFactory, SavesDatesInAppTimezone;

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
