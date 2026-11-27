<?php

// A-16 backups (#86): the database and the photos as one file in a folder on the server's main disk.
return [
    'path' => env('BACKUP_PATH') ?: storage_path('app/backups'),
];
