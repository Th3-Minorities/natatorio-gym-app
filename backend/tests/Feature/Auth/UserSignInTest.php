<?php

namespace Tests\Feature\Auth;

use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class UserSignInTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database']);
    }

    private function fromBrowser(array $cookies = []): static
    {
        $this->app['auth']->forgetGuards();
        // A new request has no in-memory attributes from the previous browser.
        $this->app['session']->flush();
        $this->defaultCookies = $cookies;

        return $this->fromThePwa()->withCredentials();
    }

    private function browserCookies(TestResponse $response): array
    {
        $names = [config('session.cookie'), Auth::guard('web')->getRecallerName()];

        return array_combine($names, array_map(fn ($name) => $response->getCookie($name)->getValue(), $names));
    }

    private function signIn(string $email = 'user@example.com', string $password = 'password')
    {
        return $this->fromThePwa()->postJson('/api/user/sign-in', compact('email', 'password'));
    }

    public function test_sign_in_is_case_insensitive_and_uses_the_user_guard(): void
    {
        $user = User::factory()->create(['email' => 'User@Example.com', 'locale' => 'en']);
        $this->signIn()->assertOk()->assertJsonPath('locale', 'en');
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertGuest('staff');
        $this->assertNotNull($user->fresh()->last_signed_in_at);
    }

    public function test_unknown_email_and_wrong_password_have_identical_answers(): void
    {
        User::factory()->create(['email' => 'user@example.com']);
        $wrong = $this->signIn(password: 'wrong')->assertUnprocessable()->json();
        $unknown = $this->signIn('unknown@example.com')->assertUnprocessable()->json();
        $this->assertSame($wrong, $unknown);
        $this->assertSame(['error' => ['code' => 'user_credentials_invalid']], $wrong);
    }

    public function test_staff_credentials_cannot_sign_in_as_a_user(): void
    {
        StaffAccount::factory()->create(['email' => 'user@example.com']);
        $this->signIn()->assertUnprocessable()->assertJsonPath('error.code', 'user_credentials_invalid');
        $this->assertGuest('web');
    }

    public function test_unknown_account_hash_uses_the_configured_bcrypt_cost(): void
    {
        Hash::partialMock()->shouldReceive('check')->twice()->withArgs(function ($password, $hash) {
            $this->assertSame(config('hashing.bcrypt.rounds'), password_get_info($hash)['options']['cost']);

            return $password === 'wrong';
        })->andReturn(false);
        foreach ([4, 12] as $rounds) {
            config(['hashing.bcrypt.rounds' => $rounds]);
            $this->signIn('unknown@example.com', 'wrong')->assertUnprocessable();
        }
    }

    public function test_sign_in_rotates_the_session_and_creates_a_persistent_cookie(): void
    {
        User::factory()->create(['email' => 'user@example.com']);
        $this->fromThePwa()->get('/api/sanctum/csrf-cookie');
        $before = session()->getId();
        $response = $this->signIn()->assertOk();
        $this->assertNotSame($before, session()->getId());
        $response->assertCookie(Auth::guard('web')->getRecallerName());
    }

    public function test_a_second_device_ends_the_first_and_leaves_only_one_current_session(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);
        $first = $this->signIn()->assertOk();
        $oldId = $user->fresh()->current_session_id;
        $firstCookies = $this->browserCookies($first);
        // A separate browser does not send the first browser's cookie.
        $this->fromBrowser();
        $second = $this->signIn()->assertOk();
        $secondCookies = $this->browserCookies($second);
        $this->assertNotSame($oldId, $user->fresh()->current_session_id);
        $this->assertDatabaseMissing('sign_in_sessions', ['id' => $oldId]);
        $this->fromBrowser($firstCookies)->getJson('/api/user/me')->assertUnauthorized()
            ->assertJsonPath('error.code', 'user_session_replaced');
        $this->fromBrowser($secondCookies)->getJson('/api/user/me')->assertOk();
    }

    public function test_an_existing_obsolete_session_gets_the_other_device_code(): void
    {
        $user = User::factory()->create(['current_session_id' => 'new-device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'old-device'])
            ->fromThePwa()->getJson('/api/user/me')->assertUnauthorized()
            ->assertJsonPath('error.code', 'user_session_replaced');
    }

    public function test_remembered_user_can_resume_after_the_short_session_expires(): void
    {
        $user = User::factory()->create(['email' => 'user@example.com']);
        $response = $this->signIn()->assertOk();
        $recaller = Auth::guard('web')->getRecallerName();
        $cookie = $response->getCookie($recaller)->getValue();
        DB::table('sign_in_sessions')->where('user_id', $user->id)->delete();
        $this->travel(3)->days();
        $this->fromBrowser([$recaller => $cookie])->getJson('/api/user/me')->assertOk();
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertTrue(Auth::guard('web')->viaRemember());
    }

    public function test_sign_out_ends_the_user_but_keeps_a_staff_sign_in(): void
    {
        User::factory()->create(['email' => 'user@example.com']);
        $this->signIn()->assertOk();
        $staff = StaffAccount::factory()->create();
        Auth::guard('staff')->login($staff);
        $this->fromThePwa()->postJson('/api/user/sign-out')->assertNoContent();
        $this->assertGuest('web');
        $this->assertAuthenticatedAs($staff, 'staff');
    }

    public function test_staff_only_sessions_are_forbidden_on_every_user_route(): void
    {
        foreach (['staff', 'admin'] as $role) {
            $this->actingAs(StaffAccount::factory()->create(compact('role')), 'staff')->fromThePwa();
            $this->getJson('/api/user/me')->assertForbidden();
            $this->postJson('/api/user/sign-out')->assertForbidden();
            $this->deleteJson('/api/user/account')->assertForbidden();
            $this->patchJson('/api/user/locale', ['locale' => 'en'])->assertForbidden();
        }
    }

    public function test_guests_cannot_use_protected_user_routes(): void
    {
        $this->fromThePwa()->getJson('/api/user/me')->assertUnauthorized();
        $this->fromThePwa()->deleteJson('/api/user/account')->assertUnauthorized();
    }

    public function test_a_user_session_cannot_use_staff_routes(): void
    {
        $this->actingAs(User::factory()->create(), 'web')->fromThePwa();
        $this->getJson('/api/staff/me')->assertUnauthorized();
        $this->postJson('/api/staff/sign-out')->assertUnauthorized();
    }

    public function test_a_deleted_user_cannot_sign_in(): void
    {
        User::factory()->create(['email' => 'user@example.com', 'deleted_at' => now()]);
        $this->signIn()->assertUnprocessable()->assertJsonPath('error.code', 'user_credentials_invalid');
    }
}
