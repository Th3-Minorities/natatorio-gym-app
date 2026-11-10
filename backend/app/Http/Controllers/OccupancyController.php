<?php

namespace App\Http\Controllers;

use App\Services\FacilitySessions;
use Illuminate\Http\JsonResponse;

class OccupancyController extends Controller
{
    public function __invoke(FacilitySessions $sessions): JsonResponse
    {
        $now = now();

        return response()->json(['count' => $sessions->occupancy($now), 'max' => config('check_in.occupancy_max'), 'updated_at' => $now->toISOString()]);
    }
}
