<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\AcademicTermFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A term never overlaps another and is never deleted (REQ-F-21, E-107). */
#[Fillable(['name', 'starts_on', 'ends_on'])]
class AcademicTerm extends Model
{
    /** @use HasFactory<AcademicTermFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['starts_on' => 'date', 'ends_on' => 'date'];
    }

    /** @return HasMany<ImportedMembership, $this> */
    public function importedMemberships(): HasMany
    {
        return $this->hasMany(ImportedMembership::class);
    }
}
