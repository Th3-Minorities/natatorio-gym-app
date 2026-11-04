<?php

namespace Tests\Feature;

use Tests\TestCase;

class PhotoDiskTest extends TestCase
{
    public function test_photos_have_their_own_disk_on_the_photo_volume(): void
    {
        // docker-compose.yml mounts the private_photos volume at /var/www/private.
        $this->assertSame('/var/www/private', config('filesystems.disks.photos.root'));
        $this->assertSame('private', config('filesystems.disks.photos.visibility'));
    }

    public function test_other_private_files_do_not_use_the_photo_volume(): void
    {
        $this->assertNotSame(config('filesystems.disks.photos.root'), config('filesystems.disks.local.root'));
    }
}
