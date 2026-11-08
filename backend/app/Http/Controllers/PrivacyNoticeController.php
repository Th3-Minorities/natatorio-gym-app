<?php

namespace App\Http\Controllers;

use App\Services\PrivacyNotice;
use Illuminate\Http\JsonResponse;

class PrivacyNoticeController extends Controller
{
    /** Read only: unlike the registration step, it records nothing in the session. */
    public function show(PrivacyNotice $notice): JsonResponse
    {
        return response()->json($notice->payload())->header('Cache-Control', 'no-store');
    }
}
