<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\SettingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/** A named value the Administrator edits, such as the gym contact number (E-66). */
#[Fillable(['name', 'value'])]
class Setting extends Model
{
    /** @use HasFactory<SettingFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected $primaryKey = 'name';

    protected $keyType = 'string';

    public $incrementing = false;
}
