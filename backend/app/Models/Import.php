<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use Database\Factories\ImportFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One WooCommerce store sync (E-127). There is no undo. */
#[Fillable(['file_name', 'created_count', 'updated_count', 'revoked_count', 'skipped_count', 'result'])]
class Import extends Model
{
    /** @use HasFactory<ImportFactory> */
    use HasFactory, SavesDatesInAppTimezone;

    protected function casts(): array
    {
        return ['result' => 'array'];
    }

    /** @return HasMany<ImportedMembership, $this> */
    public function importedMemberships(): HasMany
    {
        return $this->hasMany(ImportedMembership::class);
    }
}
