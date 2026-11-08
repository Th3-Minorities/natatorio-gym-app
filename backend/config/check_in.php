<?php

use App\Support\GymBoundary;

// Check In location rule, set per environment (REQ-NF-28, REQ-NF-29, check-in-flows D2 option A).
return [
    // C-01 level scale: the team's provisional maximum while there is no official capacity.
    'occupancy_max' => max(1, (int) (env('GYM_OCCUPANCY_MAX') ?: 40)),
    'center_latitude' => (float) (env('CHECK_IN_CENTER_LATITUDE') ?: GymBoundary::GYM_LATITUDE_PLACEHOLDER),
    'center_longitude' => (float) (env('CHECK_IN_CENTER_LONGITUDE') ?: GymBoundary::GYM_LONGITUDE_PLACEHOLDER),
    'radius_meters' => (float) env('CHECK_IN_RADIUS_METERS', 50),
    'max_accuracy_meters' => (float) env('CHECK_IN_MAX_ACCURACY_METERS', 50),
    // An athletes-only period shows as upcoming this many minutes before it starts (E-161).
    'notice_minutes' => (int) env('CHECK_IN_NOTICE_MINUTES', 60),
    // Only development and the demo set it; without it, a boundary whose center distance plus radius exceeds 50 m stops the app (REQ-NF-29, architecture D6).
    'allow_any_boundary' => (bool) env('CHECK_IN_ALLOW_ANY_BOUNDARY', false),
];
