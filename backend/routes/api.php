<?php

use App\Http\Controllers\HealthController;
use App\Http\Controllers\PaidRegistrationController;
use App\Http\Controllers\StaffSessionController;
use App\Http\Controllers\UserAccountController;
use App\Http\Controllers\UserPasswordController;
use App\Http\Controllers\UserSessionController;
use App\Http\Middleware\EnsureRegistrationGuest;
use App\Http\Middleware\EnsureUserSessionIsCurrent;
use Illuminate\Support\Facades\Route;

// Every route here is served under /api (docs/design/api-conventions.md).

Route::get('/health', HealthController::class);

Route::prefix('user/registration')->middleware(EnsureRegistrationGuest::class)->group(function () {
    Route::get('/privacy', [PaidRegistrationController::class, 'privacy']);
    Route::post('/privacy', [PaidRegistrationController::class, 'acknowledge']);
    Route::post('/lookup', [PaidRegistrationController::class, 'lookup']);
    Route::get('/waiver', [PaidRegistrationController::class, 'waiver']);
    Route::post('/complete', [PaidRegistrationController::class, 'complete']);
});

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
    Route::post('/password/email', [UserPasswordController::class, 'email'])->middleware('throttle:10,1');
    Route::post('/password/validate', [UserPasswordController::class, 'validateLink'])->middleware('throttle:30,1');
    Route::post('/password/reset', [UserPasswordController::class, 'reset'])->middleware('throttle:10,1');

    Route::middleware(EnsureUserSessionIsCurrent::class)->group(function () {
        Route::get('/me', [UserAccountController::class, 'me']);
        Route::post('/sign-out', [UserSessionController::class, 'signOut']);
        Route::patch('/locale', [UserAccountController::class, 'locale']);
        Route::delete('/account', [UserAccountController::class, 'delete']);
    });
});
