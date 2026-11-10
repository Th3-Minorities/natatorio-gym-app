<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\FacilityInformationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['topic', 'text_es', 'text_en'])]
class FacilityInformation extends Model
{
    /** @use HasFactory<FacilityInformationFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected $table = 'facility_information';
}
