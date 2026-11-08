<?php

namespace Tests\Feature\Auth;

use App\Exceptions\ApiException;
use App\Services\RegistrationPhoto;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegistrationPhotoTest extends TestCase
{
    use RefreshDatabase;

    private function decoder(): void
    {
        if (! class_exists(\Imagick::class)) {
            $this->markTestSkipped('The PHP host has no native Imagick image decoder.');
        }
    }

    public function test_missing_decoder_fails_closed_without_saving_the_original(): void
    {
        if (class_exists(\Imagick::class)) {
            $this->markTestSkipped('This host has an image decoder.');
        }
        Storage::fake('local');
        try {
            app(RegistrationPhoto::class)->save(UploadedFile::fake()->create('photo.heic', 1, 'image/heic'));
            $this->fail('The original must never be stored without conversion.');
        } catch (ApiException $error) {
            $this->assertSame('registration_photo_conversion_unavailable', $error->errorCode);
            $this->assertSame([], Storage::disk('local')->allFiles());
        }
    }

    public function test_png_becomes_a_private_jpeg_at_most_1200_pixels_and_512_kib_without_metadata(): void
    {
        $this->decoder();
        Storage::fake('local');
        $image = new \Imagick;
        $image->newImage(1600, 2000, 'white', 'png');
        $image->setImageProperty('exif:GPSLatitude', '18/1,12/1,0/1');
        $image->profileImage('xmp', '<x:xmpmeta xmlns:x="adobe:ns:meta/"><GPSLatitude>18</GPSLatitude></x:xmpmeta>');
        $file = UploadedFile::fake()->createWithContent('photo.png', $image->getImageBlob());
        $image->clear();
        $path = app(RegistrationPhoto::class)->save($file);
        $jpeg = Storage::disk('local')->get($path);
        $converted = new \Imagick;
        $converted->readImageBlob($jpeg);
        $this->assertSame('JPEG', $converted->getImageFormat());
        $this->assertLessThanOrEqual(1200, max($converted->getImageWidth(), $converted->getImageHeight()));
        $this->assertSame(960, $converted->getImageWidth());
        $this->assertSame(1200, $converted->getImageHeight());
        $this->assertLessThanOrEqual(512 * 1024, strlen($jpeg));
        $this->assertSame([], $converted->getImageProfiles('*', true));
        $this->assertSame('private', Storage::disk('local')->getVisibility($path));
        $this->assertCount(1, Storage::disk('local')->allFiles());
        $converted->clear();
    }

    public function test_heic_becomes_jpeg_when_the_host_has_a_heic_decoder(): void
    {
        $this->decoder();
        if (\Imagick::queryFormats('HEIC') === []) {
            $this->markTestSkipped('The native image decoder has no HEIC support.');
        }
        Storage::fake('local');
        $image = new \Imagick;
        $image->newImage(32, 32, 'white', 'heic');
        $file = UploadedFile::fake()->createWithContent('photo.heic', $image->getImageBlob());
        $image->clear();
        $path = app(RegistrationPhoto::class)->save($file);
        $this->assertStringStartsWith("\xff\xd8", Storage::disk('local')->get($path));
    }

    public function test_storage_failure_does_not_return_a_photo_path(): void
    {
        $this->decoder();
        $image = new \Imagick;
        $image->newImage(32, 32, 'white', 'png');
        $file = UploadedFile::fake()->createWithContent('photo.png', $image->getImageBlob());
        $image->clear();
        $disk = \Mockery::mock(FilesystemAdapter::class);
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);
        $disk->shouldReceive('put')->once()->andReturn(false);
        $disk->shouldReceive('delete')->once()->andReturn(true);
        try {
            app(RegistrationPhoto::class)->save($file);
            $this->fail('An unsaved photo must never be accepted.');
        } catch (ApiException $error) {
            $this->assertSame('registration_photo_failed', $error->errorCode);
        }
    }
}
