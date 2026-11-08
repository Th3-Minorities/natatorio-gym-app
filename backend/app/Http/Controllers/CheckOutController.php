<?php

namespace App\Http\Controllers;

use App\Services\FacilitySessions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckOutController extends Controller
{
    public function __invoke(Request $request, string $session, FacilitySessions $sessions): JsonResponse
    {
        // Numeric routing rejects scripts and SQL; integer validation also rejects a bigint overflow.
        validator(['session_id' => $session], ['session_id' => ['required', 'integer', 'min:1']])->validate();
        $ended = $sessions->checkOut($session, $request->user('staff'));

        return response()->json(['session' => $sessions->data($ended)]);
    }
}
