<?php

namespace Tests\Feature\Auth;

use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class StaffGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_csrf_cookie_route_is_under_api(): void
    {
        // The proxy only sends /api to Laravel (architecture.md, D2).
        $this->get('/api/sanctum/csrf-cookie')
            ->assertNoContent()
            ->assertCookie('XSRF-TOKEN');

        $this->get('/sanctum/csrf-cookie')->assertNotFound();
    }

    public function test_the_staff_guard_signs_in_a_staff_account(): void
    {
        $staff = StaffAccount::factory()->create(['email' => 'desk@example.com']);

        $this->assertTrue(Auth::guard('staff')->attempt(['email' => 'desk@example.com', 'password' => 'password']));
        $this->assertTrue(Auth::guard('staff')->user()->is($staff));
    }

    public function test_a_staff_sign_in_is_not_a_user_sign_in(): void
    {
        // A student employee may have both accounts with the same email (D13).
        User::factory()->create(['email' => 'both@example.com']);
        StaffAccount::factory()->create(['email' => 'both@example.com']);

        Auth::guard('staff')->attempt(['email' => 'both@example.com', 'password' => 'password']);

        $this->assertInstanceOf(StaffAccount::class, Auth::guard('staff')->user());
        $this->assertNull(Auth::guard('web')->user());
    }
}
