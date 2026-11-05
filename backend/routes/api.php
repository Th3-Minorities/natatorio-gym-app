<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\StaffSessionController;
use Illuminate\Support\Facades\Route;

// Every route here is served under /api (docs/design/api-conventions.md).

Route::get('/health', HealthController::class);

// Staff and Administrator sign-in on the gym dashboard (N-11, REQ-F-52).
Route::prefix('staff')->group(function () {
    Route::post('/sign-in', [StaffSessionController::class, 'signIn']);

    Route::middleware('auth:staff')->group(function () {
        Route::post('/sign-out', [StaffSessionController::class, 'signOut']);
        Route::get('/me', [StaffSessionController::class, 'me']);
    });
});
