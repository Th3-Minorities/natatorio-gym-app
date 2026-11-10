<?php

use App\Http\Controllers\AcademicTermController;
use App\Http\Controllers\ActiveSessionsController;
use App\Http\Controllers\AthleteRegistrationController;
use App\Http\Controllers\CheckInController;
use App\Http\Controllers\CheckOutController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\OccupancyController;
use App\Http\Controllers\PaidRegistrationController;
use App\Http\Controllers\PrivacyNoticeController;
use App\Http\Controllers\RosterController;
use App\Http\Controllers\RosterDownloadController;
use App\Http\Controllers\StaffAccountController;
use App\Http\Controllers\StaffInvitationController;
use App\Http\Controllers\StaffPasswordController;
use App\Http\Controllers\StaffPeopleController;
use App\Http\Controllers\StaffSessionController;
use App\Http\Controllers\UserAccountController;
use App\Http\Controllers\UserPasswordController;
use App\Http\Controllers\UserSessionController;
use App\Http\Middleware\EnsureRegistrationGuest;
use App\Http\Middleware\EnsureUserSessionIsCurrent;
use Illuminate\Support\Facades\Route;

// Every route here is served under /api (docs/design/api-conventions.md).

Route::get('/health', HealthController::class);

// The privacy notice data (N-08) for any visitor or signed-in User; the registration step has its own route.
Route::get('/privacy', [PrivacyNoticeController::class, 'show']);

Route::prefix('user/registration')->middleware(EnsureRegistrationGuest::class)->group(function () {
    Route::get('/privacy', [PaidRegistrationController::class, 'privacy']);
    Route::post('/privacy', [PaidRegistrationController::class, 'acknowledge']);
    Route::post('/lookup', [PaidRegistrationController::class, 'lookup']);
    Route::get('/waiver', [PaidRegistrationController::class, 'waiver']);
    Route::post('/complete', [PaidRegistrationController::class, 'complete']);
    // The page the athlete's email link opens (REQ-F-15).
    Route::post('/athlete/validate', [AthleteRegistrationController::class, 'validateLink'])
        ->name('user.registration.athlete.validate')->middleware('throttle:user.registration.athlete.validate');
    Route::post('/athlete/complete', [AthleteRegistrationController::class, 'completeAthlete'])
        ->name('user.registration.athlete.complete')->middleware('throttle:user.registration.athlete.complete');
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
        // S-01 shows the same occupancy as C-01 on the User side (REQ-F-41, #26).
        Route::get('/occupancy', OccupancyController::class);
        Route::post('/sessions/{session}/check-out', CheckOutController::class)->whereNumber('session');
        // S-01's list of who is inside and each one's photo (#26, REQ-F-44, REQ-F-45).
        Route::get('/sessions', [ActiveSessionsController::class, 'index']);
        Route::get('/sessions/{session}/photo', [ActiveSessionsController::class, 'photo'])->where('session', '[0-9]{1,18}');
        // S-02: the visit and the person, and the corrections on an active visit (REQ-F-48, REQ-NF-19).
        Route::get('/sessions/{session}', [ActiveSessionsController::class, 'show'])->where('session', '[0-9]{1,18}');
        Route::post('/sessions/{session}/end-early', [ActiveSessionsController::class, 'endEarly'])->where('session', '[0-9]{1,18}');
        Route::post('/sessions/{session}/void', [ActiveSessionsController::class, 'void'])->where('session', '[0-9]{1,18}');
        // S-03: find a person, compare the photo, mark it pending, and the assisted Check In (REQ-F-46, REQ-F-94).
        Route::get('/people', [StaffPeopleController::class, 'search']);
        Route::get('/people/{user}/photo', [StaffPeopleController::class, 'photo'])->where('user', '[0-9]{1,18}');
        Route::post('/people/{user}/photo-pending', [StaffPeopleController::class, 'photoPending'])->where('user', '[0-9]{1,18}');
        Route::post('/check-in', [StaffPeopleController::class, 'checkIn']);
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

    // Academic terms screen (A-04, REQ-F-21). No delete route: terms are never deleted (E-107).
    Route::middleware(['auth:staff', 'staff.active', 'role:admin'])->group(function () {
        Route::get('/terms', [AcademicTermController::class, 'index']);
        Route::post('/terms', [AcademicTermController::class, 'store']);
        Route::patch('/terms/{term}', [AcademicTermController::class, 'update'])->whereNumber('term');
    });

    // Athlete roster: Staff read the active athletes (E-59); Administrators add and edit them on A-05 (REQ-F-49).
    Route::middleware(['auth:staff', 'staff.active', 'role:staff,admin'])->group(function () {
        Route::get('/roster', [RosterController::class, 'index']);
    });
    Route::middleware(['auth:staff', 'staff.active', 'role:admin'])->group(function () {
        // The whole roster as Word or PDF (REQ-F-100); Staff cannot download it (E-140).
        Route::get('/roster/download', RosterDownloadController::class);
        Route::post('/roster', [RosterController::class, 'store']);
        Route::patch('/roster/{athlete}', [RosterController::class, 'update'])->whereNumber('athlete');
        Route::post('/roster/{athlete}/withdraw', [RosterController::class, 'withdraw'])->whereNumber('athlete');
        Route::post('/roster/{athlete}/reinstate', [RosterController::class, 'reinstate'])->whereNumber('athlete');
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
