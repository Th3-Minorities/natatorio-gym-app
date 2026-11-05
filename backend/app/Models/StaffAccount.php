<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\StaffAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** A Staff member or Administrator with a personal account. Never deleted, only deactivated (D13). */
#[Fillable(['name', 'email', 'password', 'role', 'locale', 'deactivated_at'])]
#[Hidden(['password'])]
class StaffAccount extends Model
{
    /** @use HasFactory<StaffAccountFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['password' => 'hashed', 'deactivated_at' => 'datetime'];
    }
}
