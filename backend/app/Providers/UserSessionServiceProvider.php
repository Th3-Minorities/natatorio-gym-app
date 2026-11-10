<?php

namespace App\Providers;

use App\Session\UserDatabaseSessionHandler;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\ServiceProvider;

class UserSessionServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Session::extend('database', fn ($app) => new UserDatabaseSessionHandler(
            DB::connection(config('session.connection')),
            config('session.table'),
            config('session.lifetime'),
            $app,
        ));
    }
}
