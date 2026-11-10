<?php

namespace Tests\Feature\Auth;

use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** The backend allows or denies each action by role, as in the SRS role table (REQ-F-52). */
class StaffRolesTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Stand-ins for a desk action and an Administrator action, in the api group like routes/api.php.
        Route::middleware(['api', 'auth:staff', 'staff.active', 'role:staff,admin'])
            ->get('/api/test/desk-action', fn () => response()->noContent());
        Route::middleware(['api', 'auth:staff', 'staff.active', 'role:admin'])
            ->get('/api/test/admin-action', fn () => response()->noContent());
    }

    public function test_staff_can_do_desk_actions(): void
    {
        $this->actingAs(StaffAccount::factory()->create(), 'staff')
            ->fromThePwa()
            ->getJson('/api/test/desk-action')
            ->assertNoContent();
    }

    public function test_staff_are_forbidden_administrator_actions(): void
    {
        $this->actingAs(StaffAccount::factory()->create(), 'staff')
            ->fromThePwa()
            ->getJson('/api/test/admin-action')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'forbidden');
    }

    public function test_administrators_can_do_both(): void
    {
        $admin = StaffAccount::factory()->admin()->create();

        $this->actingAs($admin, 'staff')->fromThePwa()->getJson('/api/test/desk-action')->assertNoContent();
        $this->actingAs($admin, 'staff')->fromThePwa()->getJson('/api/test/admin-action')->assertNoContent();
    }

    public function test_user_accounts_cannot_do_any_gym_action(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'web')->fromThePwa()->getJson('/api/test/desk-action')->assertUnauthorized();
        $this->actingAs($user, 'web')->fromThePwa()->getJson('/api/test/admin-action')->assertUnauthorized();
    }

    public function test_nobody_signed_in_cannot_do_any_gym_action(): void
    {
        $this->fromThePwa()->getJson('/api/test/desk-action')->assertUnauthorized();
        $this->fromThePwa()->getJson('/api/test/admin-action')->assertUnauthorized();
    }
}
