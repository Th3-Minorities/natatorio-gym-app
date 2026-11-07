<?php

return [
    // Provisional lookup limits; the team has not selected REG-1 and REG-2 values.
    'ip_failures' => 10,
    'global_failures' => 100,
    'window_seconds' => 900,
    'slow_milliseconds' => 500,
    'privacy_version' => 'draft',
    // No acceptance of a made-up waiver. Set the approved text and version before registration opens.
    'waiver' => ['version' => null, 'es' => null, 'en' => null],
];
