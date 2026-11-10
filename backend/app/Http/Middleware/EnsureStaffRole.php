<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * role:staff,admin or role:admin on a staff route, following the SRS role table (REQ-F-52).
 * Runs after auth:staff; any other role gets 403 forbidden, even if the screen shows the action.
 */
class EnsureStaffRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        abort_unless(in_array($request->user('staff')?->role, $roles, true), 403);

        return $next($request);
    }
}
