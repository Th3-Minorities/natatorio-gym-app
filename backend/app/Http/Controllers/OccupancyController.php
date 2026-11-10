<?php

namespace App\Http\Controllers;

use App\Services\FacilitySessions;
use App\Services\GymSchedule;
use Illuminate\Http\JsonResponse;

class OccupancyController extends Controller
{
    /** gym: open, athletes_only or closed, by the same schedule Check In uses, for the S-01 chip (#26). */
    public function __invoke(FacilitySessions $sessions, GymSchedule $schedule): JsonResponse
    {
        $now = now();

        return response()->json([
            'count' => $sessions->occupancy($now),
            'max' => config('check_in.occupancy_max'),
            'updated_at' => $now->toISOString(),
            'gym' => $schedule->state($now),
        ]);
    }
}
