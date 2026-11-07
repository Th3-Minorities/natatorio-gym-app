<?php

namespace App\Session;

use Illuminate\Session\DatabaseSessionHandler;

class UserDatabaseSessionHandler extends DatabaseSessionHandler
{
    protected function userId()
    {
        // This column references Users, never a staff account with a coincident numeric id.
        return $this->container->make('auth')->guard('web')->id();
    }

    protected function ipAddress()
    {
        return null;
    }

    protected function userAgent()
    {
        return null;
    }
}
