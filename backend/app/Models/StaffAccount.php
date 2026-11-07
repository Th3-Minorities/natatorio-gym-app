<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
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
}
