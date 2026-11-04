<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\ImportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One WooCommerce import batch. Never deleted: undo sets undone_at (E-84). */
#[Fillable(['file_name', 'created_count', 'updated_count', 'rejected_count', 'result', 'undone_at'])]
class Import extends Model
{
    /** @use HasFactory<ImportFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['result' => 'array', 'undone_at' => 'datetime'];
    }

    /** @return HasMany<ImportedMembership, $this> */
    public function importedMemberships(): HasMany
    {
        return $this->hasMany(ImportedMembership::class);
    }
}
