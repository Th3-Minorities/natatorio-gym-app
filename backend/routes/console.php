<?php

use App\Console\Commands\DeleteExpiredData;
use App\Services\AuditLog;
use App\Services\Backups;
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

Schedule::command(DeleteExpiredData::class)->daily()->withoutOverlapping();
// A-16 (#86): checks every day at 2:00 and backs up when the last copy is 14 days old.
Schedule::call(fn () => app(Backups::class)->runIfDue(app(AuditLog::class)))
    ->name('backups')->dailyAt('02:00')->withoutOverlapping();
