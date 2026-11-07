<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class UserPhotoCleanup
{
    public function deletePending(?array $paths = null): void
    {
        $pending = DB::table('pending_photo_deletions');
        if ($paths !== null) {
            $pending->whereIn('path', $paths);
        }

        foreach ($pending->lazyById() as $photo) {
            try {
                if (! Storage::disk('local')->delete($photo->path)) {
                    throw new RuntimeException('Unable to delete account photo.');
                }
                DB::table('pending_photo_deletions')->where('id', $photo->id)->delete();
            } catch (Throwable $error) {
                // Keep the path for the next scheduler run, including when storage throws.
                report($error);
            }
        }
    }
}
