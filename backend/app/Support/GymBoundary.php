<?php

namespace App\Support;

use RuntimeException;

/** Where Check In is allowed (REQ-NF-28, REQ-NF-29). */
class GymBoundary
{
    /** PLACEHOLDER: the gym has not been measured yet (REQ-NF-28). Replace with the measured coordinates. */
    public const GYM_LATITUDE_PLACEHOLDER = 18.2110;

    public const GYM_LONGITUDE_PLACEHOLDER = -67.1410;

    private const MAX_CENTER_DISTANCE_METERS = 50;

    public static function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $a = sin(deg2rad($lat2 - $lat1) / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin(deg2rad($lng2 - $lng1) / 2) ** 2;

        return 2 * 6_371_000 * asin(min(1, sqrt($a)));
    }

    public static function contains(float $latitude, float $longitude): bool
    {
        return self::distanceMeters(config('check_in.center_latitude'), config('check_in.center_longitude'), $latitude, $longitude)
            <= config('check_in.radius_meters');
    }

    /** Runs at every start: a forgotten flag fails safe (architecture D6). */
    public static function assertNearTheGym(): void
    {
        $production = app()->environment('production');
        // The flag is for development and the demo only; production never honors it (REQ-NF-29).
        if (config('check_in.allow_any_boundary') && ! $production) {
            return;
        }
        if ($production && config('check_in.radius_meters') > self::MAX_CENTER_DISTANCE_METERS) {
            throw new RuntimeException('The Check In radius is over 50 m. Fix CHECK_IN_RADIUS_METERS.');
        }
        $distance = self::distanceMeters(
            self::GYM_LATITUDE_PLACEHOLDER, self::GYM_LONGITUDE_PLACEHOLDER,
            config('check_in.center_latitude'), config('check_in.center_longitude'),
        );
        if ($distance > self::MAX_CENTER_DISTANCE_METERS) {
            throw new RuntimeException('The Check In boundary center is more than 50 m from the gym. Fix CHECK_IN_CENTER_* or, outside production, set CHECK_IN_ALLOW_ANY_BOUNDARY=true.');
        }
    }
}
