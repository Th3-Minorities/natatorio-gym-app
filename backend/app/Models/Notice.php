<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\NoticeFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['text_es', 'text_en', 'shown_from', 'shown_until'])]
class Notice extends Model
{
    /** @use HasFactory<NoticeFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['shown_from' => 'datetime', 'shown_until' => 'datetime'];
    }
}
