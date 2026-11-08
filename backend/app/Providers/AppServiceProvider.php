<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
        foreach (['user.password.email' => 10, 'user.password.validate' => 30, 'user.password.reset' => 10,
            'staff.invitation.validate' => 30, 'staff.invitation.accept' => 10,
            'staff.password.email' => 10, 'staff.password.validate' => 30, 'staff.password.reset' => 10] as $name => $limit) {
            RateLimiter::for($name, fn (Request $request) => Limit::perMinute($limit)
                ->by($request->route()->getName().'|'.$request->ip()));
        }

        // Each invitation sends an email, so one Administrator cannot flood inboxes.
        RateLimiter::for('staff.invite', fn (Request $request) => Limit::perMinute(10)
            ->by('staff.invite|'.$request->user('staff')?->getAuthIdentifier()));
    }
}
