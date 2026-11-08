<?php

use App\Http\Controllers\CheckInController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\OccupancyController;
use App\Http\Controllers\StaffSessionController;
use App\Http\Controllers\UserAccountController;
use App\Http\Controllers\UserPasswordController;
use App\Http\Controllers\UserSessionController;
use App\Http\Middleware\EnsureUserSessionIsCurrent;
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

Route::prefix('user')->group(function () {
    Route::post('/sign-in', [UserSessionController::class, 'signIn']);
    Route::post('/password/email', [UserPasswordController::class, 'email'])
        ->name('user.password.email')->middleware('throttle:user.password.email');
    Route::post('/password/validate', [UserPasswordController::class, 'validateLink'])
        ->name('user.password.validate')->middleware('throttle:user.password.validate');
    Route::post('/password/reset', [UserPasswordController::class, 'reset'])
        ->name('user.password.reset')->middleware('throttle:user.password.reset');

    Route::middleware(EnsureUserSessionIsCurrent::class)->group(function () {
        Route::get('/me', [UserAccountController::class, 'me']);
        Route::get('/photo', [UserAccountController::class, 'photo']);
        Route::get('/occupancy', OccupancyController::class);
        Route::post('/sign-out', [UserSessionController::class, 'signOut']);
        Route::patch('/locale', [UserAccountController::class, 'locale']);
        Route::delete('/account', [UserAccountController::class, 'delete']);
        Route::get('/check-in', [CheckInController::class, 'show']);
        Route::post('/check-in', [CheckInController::class, 'store'])
            ->name('user.check-in')->middleware('throttle:user.check-in');
    });
});
