<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * A gym User (paid member, athlete or manual grant). Never hard-deleted: deleting the account
 * sets every personal column to NULL and deleted_at (decision D2). The name is in the waiver (D7).
 */
#[Fillable(['email', 'password', 'locale', 'current_session_id', 'deleted_at'])]
#[Hidden(['password'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SavesDatesInAppTimezone;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'deleted_at' => 'datetime',
        ];
    }

    /** @return HasMany<Authorization, $this> */
    public function authorizations(): HasMany
    {
        return $this->hasMany(Authorization::class);
    }

    /** @return HasOne<WaiverAcceptance, $this> */
    public function waiverAcceptance(): HasOne
    {
        return $this->hasOne(WaiverAcceptance::class);
    }
}
