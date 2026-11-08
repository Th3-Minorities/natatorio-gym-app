<?php

namespace App\Providers;

use App\Services\FakeMembershipStore;
use App\Services\MembershipStore;
use Illuminate\Support\ServiceProvider;

class RegistrationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(MembershipStore::class, FakeMembershipStore::class);
    }
}
