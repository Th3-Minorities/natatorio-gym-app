<?php

namespace Tests\Feature\Auth;

use App\Models\StaffAccount;
use App\Models\User;
use App\Services\UserSessions;
use App\Session\UserDatabaseSessionHandler;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class UserSessionStorageTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_sessions_store_only_user_ids_and_no_client_ip_or_browser(): void
    {
        $staff = StaffAccount::factory()->create();
        $this->actingAs($staff, 'staff');
        $handler = new UserDatabaseSessionHandler(DB::connection(), 'sign_in_sessions', 120, $this->app);
        $handler->write('staff-device', '{}');
        $this->assertDatabaseHas('sign_in_sessions', ['id' => 'staff-device', 'user_id' => null, 'ip_address' => null, 'user_agent' => null]);
        $user = User::factory()->create();
        $this->actingAs($user, 'web');
        $handler = new UserDatabaseSessionHandler(DB::connection(), 'sign_in_sessions', 120, $this->app);
        $handler->write('user-device', '{}');
        $this->assertDatabaseHas('sign_in_sessions', ['id' => 'user-device', 'user_id' => $user->id, 'ip_address' => null, 'user_agent' => null]);
    }

    public function test_revocation_preserves_a_staff_sign_in_in_the_same_browser(): void
    {
        $user = User::factory()->create();
        $staff = StaffAccount::factory()->create();
        $webKey = Auth::guard('web')->getName();
        $staffKey = Auth::guard('staff')->getName();
        $data = [$webKey => $user->id, $staffKey => $staff->id, 'user_session_id' => 'old', '_token' => 'csrf'];
        DB::table('sign_in_sessions')->insert([
            'id' => 'both', 'user_id' => $user->id, 'payload' => base64_encode(json_encode($data)), 'last_activity' => time(),
        ]);
        app(UserSessions::class)->revoke($user);
        $saved = DB::table('sign_in_sessions')->where('id', 'both')->sole();
        $decoded = json_decode(base64_decode($saved->payload), true);
        $this->assertSame($staff->id, $decoded[$staffKey]);
        $this->assertArrayNotHasKey($webKey, $decoded);
        $this->assertArrayNotHasKey('user_session_id', $decoded);
        $this->assertNull($saved->user_id);
    }

    public function test_revocation_deletes_user_only_sessions_and_leaves_other_users_alone(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        foreach (['old' => $user->id, 'current' => $user->id, 'other' => $other->id] as $id => $owner) {
            DB::table('sign_in_sessions')->insert(['id' => $id, 'user_id' => $owner, 'payload' => base64_encode('{}'), 'last_activity' => time()]);
        }
        app(UserSessions::class)->revoke($user, 'current');
        $this->assertDatabaseMissing('sign_in_sessions', ['id' => 'old']);
        $this->assertDatabaseHas('sign_in_sessions', ['id' => 'current']);
        $this->assertDatabaseHas('sign_in_sessions', ['id' => 'other']);
    }
}
