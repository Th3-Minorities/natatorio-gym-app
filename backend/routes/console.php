<?php

use App\Services\FacilitySessions;
use App\Services\UserPhotoCleanup;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(fn () => app(UserPhotoCleanup::class)->deletePending())
    ->name('delete-user-photos')->everyMinute()->withoutOverlapping();

Schedule::call(fn () => app(FacilitySessions::class)->closeDue())
    ->name('close-facility-sessions')->everyMinute()->withoutOverlapping();
