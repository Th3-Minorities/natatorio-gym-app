<?php

namespace Tests\Feature\Auth;

use App\Http\Middleware\EnsureUserSessionIsCurrent;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as Router;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Every /api route either is public on purpose or checks the sign-in and the role on the
 * server (REQ-F-52). A new route that forgets its checks fails here.
 */
class RouteProtectionTest extends TestCase
{
    /** Routes anyone may call without signing in. Add one here only on purpose. */
    private const PUBLIC_ROUTES = [
        'GET api/health',
        'GET api/sanctum/csrf-cookie',
        'POST api/staff/sign-in',
        'POST api/user/sign-in',
        'POST api/user/password/email',
        'POST api/user/password/validate',
        'POST api/user/password/reset',
        'GET api/user/registration/privacy',
        'POST api/user/registration/privacy',
        'POST api/user/registration/lookup',
        'GET api/user/registration/waiver',
        'POST api/user/registration/complete',
    ];

    /** @return list<Route> */
    private function apiRoutes(): array
    {
        return array_values(array_filter(
            Router::getRoutes()->getRoutes(),
            fn (Route $route) => Str::startsWith($route->uri(), 'api/'),
        ));
    }

    private function label(Route $route): string
    {
        return collect($route->methods())->reject(fn ($method) => $method === 'HEAD')->implode('|').' '.$route->uri();
    }

    public function test_every_api_route_is_public_on_purpose_or_checks_sign_in_and_role(): void
    {
        foreach ($this->apiRoutes() as $route) {
            $name = $this->label($route);

            if (in_array($name, self::PUBLIC_ROUTES, true)) {
                continue;
            }

            // User routes (#15) will add their own rule here, with the User sign-in.
            $middleware = $route->gatherMiddleware();
            if (Str::startsWith($route->uri(), 'api/user/')) {
                $this->assertContains(EnsureUserSessionIsCurrent::class, $middleware, "{$name} has no current User session check.");

                continue;
            }
            $this->assertContains('auth:staff', $middleware, "{$name} has no sign-in check.");
            $this->assertContains('staff.active', $middleware, "{$name} has no staff.active check (E-130).");
            $this->assertNotEmpty(
                array_filter($middleware, fn ($m) => is_string($m) && Str::startsWith($m, 'role:')),
                "{$name} has no role check (REQ-F-52).",
            );
        }
    }

    public function test_the_public_list_has_no_routes_that_are_gone(): void
    {
        $names = array_map($this->label(...), $this->apiRoutes());

        foreach (self::PUBLIC_ROUTES as $public) {
            $this->assertContains($public, $names, "{$public} is in the public list but no longer exists.");
        }
    }
}
