<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\StaffSessionController;
use Illuminate\Support\Facades\Route;

// Every route here is served under /api (docs/design/api-conventions.md).

Route::get('/health', HealthController::class);

// Staff and Administrator sign-in on the gym dashboard (N-11, REQ-F-52).
// Every staff route needs auth:staff, staff.active and a role: check; RouteProtectionTest enforces it.
Route::prefix('staff')->group(function () {
    Route::post('/sign-in', [StaffSessionController::class, 'signIn']);

    Route::middleware(['auth:staff', 'staff.active', 'role:staff,admin'])->group(function () {
        Route::post('/sign-out', [StaffSessionController::class, 'signOut']);
        Route::get('/me', [StaffSessionController::class, 'me']);
    });
});
