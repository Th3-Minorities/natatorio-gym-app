<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\FacilitySessionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One visit: from Check In to check-out, or to 2 hours after the Check In (D14). */
#[Fillable([
    'user_id', 'authorization_id', 'authorization_type', 'member_group', 'sport', 'started_at', 'ends_at', 'ended_at',
    'status', 'assisted', 'entered_by_staff_account_id', 'checked_out_by_staff_account_id',
])]
class FacilitySession extends Model
{
    /** @use HasFactory<FacilitySessionFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ends_at' => 'datetime', 'ended_at' => 'datetime', 'assisted' => 'boolean'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Authorization, $this> */
    public function authorization(): BelongsTo
    {
        return $this->belongsTo(Authorization::class);
    }

    /** @return BelongsTo<StaffAccount, $this> */
    public function enteredBy(): BelongsTo
    {
        return $this->belongsTo(StaffAccount::class, 'entered_by_staff_account_id');
    }

    /** @return BelongsTo<StaffAccount, $this> */
    public function checkedOutBy(): BelongsTo
    {
        return $this->belongsTo(StaffAccount::class, 'checked_out_by_staff_account_id');
    }
}
