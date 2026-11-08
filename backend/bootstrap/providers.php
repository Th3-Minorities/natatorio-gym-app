<?php

use App\Providers\AppServiceProvider;
use App\Providers\RegistrationServiceProvider;
use App\Providers\UserSessionServiceProvider;

return [
    AppServiceProvider::class,
    UserSessionServiceProvider::class,
    RegistrationServiceProvider::class,
];
