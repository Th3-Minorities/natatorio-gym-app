<?php

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class RegistrationPhoto
{
    public function save(UploadedFile $file): string
    {
        // Fail closed on hosts without the native JPEG/PNG/HEIC decoder; never retain the original.
        if (! class_exists(\Imagick::class)) {
            throw new ApiException('registration_photo_conversion_unavailable', 503);
        }
        $image = new \Imagick;
        try {
            $image->setResourceLimit(\Imagick::RESOURCETYPE_MEMORY, 64 * 1024 * 1024);
            $image->setResourceLimit(\Imagick::RESOURCETYPE_MAP, 128 * 1024 * 1024);
            $image->readImage($file->getRealPath().'[0]');
            if (! in_array(strtoupper($image->getImageFormat()), ['JPEG', 'PNG', 'HEIC', 'HEIF'], true)) {
                throw new ApiException('registration_photo_invalid', 422);
            }
            $image->autoOrient();
            if (max($image->getImageWidth(), $image->getImageHeight()) > 1200) {
                $image->thumbnailImage(1200, 1200, true);
            }
            $image->setImagePage(0, 0, 0, 0);
            $image->setImageBackgroundColor('white');
            $flat = $image->mergeImageLayers(\Imagick::LAYERMETHOD_FLATTEN);
            $image->clear();
            $image = $flat;
            $image->stripImage();
            $image->setImageFormat('jpeg');
            for ($quality = 85; $quality >= 25; $quality -= 10) {
                $image->setImageCompressionQuality($quality);
                $jpeg = $image->getImageBlob();
                if (strlen($jpeg) <= 512 * 1024) {
                    break;
                }
            }
            while (strlen($jpeg) > 512 * 1024 && max($image->getImageWidth(), $image->getImageHeight()) > 1) {
                $image->thumbnailImage(
                    max(1, intdiv($image->getImageWidth(), 2)),
                    max(1, intdiv($image->getImageHeight(), 2)),
                    true,
                );
                $jpeg = $image->getImageBlob();
            }
            if (strlen($jpeg) > 512 * 1024) {
                throw new ApiException('registration_photo_invalid', 422);
            }
            $path = 'photos/'.Str::uuid().'.jpg';
            if (! Storage::disk('local')->put($path, $jpeg, ['visibility' => 'private'])) {
                throw new ApiException('registration_photo_failed', 422);
            }

            return $path;
        } catch (Throwable $error) {
            if (isset($path)) {
                DB::table('pending_photo_deletions')->insert(['path' => $path]);
                app(UserPhotoCleanup::class)->deletePending([$path]);
            }
            if ($error instanceof ApiException) {
                throw $error;
            }
            report($error);
            throw new ApiException('registration_photo_failed', 422);
        } finally {
            $image->clear();
        }
    }
}
