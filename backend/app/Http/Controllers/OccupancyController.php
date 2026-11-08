<?php

namespace App\Http\Controllers;

use App\Models\FacilitySession;
use Illuminate\Http\JsonResponse;

class OccupancyController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $now = now();
        $count = FacilitySession::query()->where('status', '<>', 'void')
            ->where('started_at', '<=', $now)->where('ends_at', '>', $now)
            ->where(fn ($query) => $query->whereNull('ended_at')->orWhere('ended_at', '>', $now))
            ->count();

        return response()->json(['count' => $count, 'max' => config('check_in.occupancy_max'), 'updated_at' => $now->toISOString()]);
    }
}
