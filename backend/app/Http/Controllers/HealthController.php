<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    /** The API is up and can reach the database. */
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('select 1');
        } catch (Throwable $e) {
            report($e);

            throw new ApiException('database_unavailable', 503);
        }

        return response()->json(['status' => 'ok']);
    }
}
