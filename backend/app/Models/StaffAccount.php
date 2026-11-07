<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use App\Notifications\StaffPasswordReset;
use Database\Factories\StaffAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/** A Staff member or Administrator with a personal account. Never deleted, only deactivated (D13). */
#[Fillable(['name', 'email', 'password', 'role', 'locale', 'deactivated_at'])]
#[Hidden(['password'])]
class StaffAccount extends Authenticatable
{
    /** @use HasFactory<StaffAccountFactory> */
    use HasFactory, Notifiable, SavesDatesInAppTimezone;

    // The table has no remember_token column: staff sign-ins never use "remember me".
    protected $rememberTokenName = '';

    protected function casts(): array
    {
        return ['password' => 'hashed', 'deactivated_at' => 'datetime'];
    }

    /** Called by the staff_accounts password broker. */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new StaffPasswordReset($token));
    }

    /**
     * A keyed hash of the password hash. Each sign-in keeps it, and a sign-in whose copy no longer
     * matches ends, so changing the password signs the account out everywhere.
     */
    public function passwordFingerprint(): string
    {
        return hash_hmac('sha256', (string) $this->password, (string) config('app.key'));
    }

    /** active, invited (no password yet) or deactivated, as the A-15 list shows it. */
    public function status(): string
    {
        return match (true) {
            $this->deactivated_at !== null => 'deactivated',
            $this->password === null => 'invited',
            default => 'active',
        };
    }
}
