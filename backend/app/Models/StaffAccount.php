<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\StaffAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;

/**
 * A Staff member or Administrator, signed in as themselves (decision D13).
 * Never deleted: setting deactivated_at ends access and keeps their audit entries.
 */
#[Fillable(['name', 'email', 'password', 'role', 'locale', 'deactivated_at'])]
#[Hidden(['password'])]
class StaffAccount extends Authenticatable
{
    /** @use HasFactory<StaffAccountFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['password' => 'hashed', 'deactivated_at' => 'datetime'];
    }

    /** @return HasMany<AuditLogEntry, $this> */
    public function auditLogEntries(): HasMany
    {
        return $this->hasMany(AuditLogEntry::class);
    }
}
