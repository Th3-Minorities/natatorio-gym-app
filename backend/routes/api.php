<?php

use App\Http\Controllers\CheckInController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\OccupancyController;
use App\Http\Controllers\PaidRegistrationController;
use App\Http\Controllers\StaffAccountController;
use App\Http\Controllers\StaffInvitationController;
use App\Http\Controllers\StaffPasswordController;
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
    Route::post('/password/email', [StaffPasswordController::class, 'email'])
        ->name('staff.password.email')->middleware('throttle:staff.password.email');
    Route::post('/password/validate', [StaffPasswordController::class, 'validateLink'])
        ->name('staff.password.validate')->middleware('throttle:staff.password.validate');
    Route::post('/password/reset', [StaffPasswordController::class, 'reset'])
        ->name('staff.password.reset')->middleware('throttle:staff.password.reset');
    Route::post('/invitation/validate', [StaffInvitationController::class, 'validateLink'])
        ->name('staff.invitation.validate')->middleware('throttle:staff.invitation.validate');
    Route::post('/invitation/accept', [StaffInvitationController::class, 'accept'])
        ->name('staff.invitation.accept')->middleware('throttle:staff.invitation.accept');

    Route::middleware(['auth:staff', 'staff.active', 'role:staff,admin'])->group(function () {
        Route::post('/sign-out', [StaffSessionController::class, 'signOut']);
        Route::get('/me', [StaffSessionController::class, 'me']);
    });

    // Staff accounts screen (A-15, REQ-F-88).
    Route::middleware(['auth:staff', 'staff.active', 'role:admin'])->group(function () {
        Route::get('/accounts', [StaffAccountController::class, 'index']);
        Route::post('/accounts', [StaffAccountController::class, 'invite'])->middleware('throttle:staff.invite');
        Route::post('/accounts/{account}/invitation', [StaffAccountController::class, 'resendInvitation'])
            ->whereNumber('account')->middleware('throttle:staff.invite');
        Route::patch('/accounts/{account}/role', [StaffAccountController::class, 'changeRole'])->whereNumber('account');
        Route::post('/accounts/{account}/deactivate', [StaffAccountController::class, 'deactivate'])->whereNumber('account');
        Route::post('/accounts/{account}/reactivate', [StaffAccountController::class, 'reactivate'])->whereNumber('account');
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
