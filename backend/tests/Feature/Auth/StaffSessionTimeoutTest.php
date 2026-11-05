<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/**
 * A staff sign-in ends after 2 hours without a person tapping or typing, an Administrator
 * sign-in after 20 minutes; automatic refreshes do not count (REQ-NF-10, E-130).
 */
class StaffSessionTimeoutTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private TestResponse $last;

    private function signIn(StaffAccount $account): void
    {
        $this->last = $this->fromThePwa()
            ->postJson('/api/staff/sign-in', ['email' => $account->email, 'password' => 'password'])
            ->assertOk();
    }

    /** A request the person made, like opening a screen. */
    private function tap(): TestResponse
    {
        return $this->last = $this->keepingTheSessionOf($this->last)->getJson('/api/staff/me');
    }

    /** A request the screen made by itself, like the occupancy refresh. */
    private function autoRefresh(): TestResponse
    {
        return $this->last = $this->keepingTheSessionOf($this->last)
            ->withHeader('X-Auto-Refresh', '1')
            ->getJson('/api/staff/me');
    }

    /** Refreshes every 30 minutes for $minutes, so only the inactivity rule can end the sign-in. */
    private function idleWithAutoRefresh(int $minutes): void
    {
        for ($done = 30; $done <= $minutes; $done += 30) {
            $this->travel(30)->minutes();

            if ($done < $minutes) {
                $this->autoRefresh();
            }
        }
    }

    public function test_a_staff_sign_in_lasts_just_under_two_hours_without_activity(): void
    {
        $this->signIn(StaffAccount::factory()->create());

        $this->idleWithAutoRefresh(90);
        $this->travel(29)->minutes();
        $this->travel(59)->seconds();

        $this->autoRefresh()->assertOk();
    }

    public function test_a_staff_sign_in_ends_after_two_hours_without_activity(): void
    {
        $this->signIn(StaffAccount::factory()->create());

        $this->idleWithAutoRefresh(120);

        $this->autoRefresh()
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'staff_session_expired');
        $this->tap()->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
    }

    public function test_an_administrator_sign_in_ends_after_twenty_minutes_without_activity(): void
    {
        $this->signIn(StaffAccount::factory()->admin()->create());

        $this->travel(19)->minutes();
        $this->autoRefresh()->assertOk();

        $this->travel(1)->minutes();
        $this->autoRefresh()->assertJsonPath('error.code', 'staff_session_expired');
    }

    public function test_a_tap_or_a_keystroke_starts_the_time_again(): void
    {
        $this->signIn(StaffAccount::factory()->admin()->create());

        $this->travel(15)->minutes();
        $this->tap()->assertOk();
        $this->travel(15)->minutes();

        $this->autoRefresh()->assertOk();
    }

    public function test_automatic_refreshes_do_not_start_the_time_again(): void
    {
        $this->signIn(StaffAccount::factory()->admin()->create());

        $this->travel(15)->minutes();
        $this->autoRefresh()->assertOk();
        $this->travel(5)->minutes();

        $this->autoRefresh()->assertJsonPath('error.code', 'staff_session_expired');
    }

    public function test_the_timeout_is_written_to_the_audit_log_as_a_sign_out(): void
    {
        $admin = StaffAccount::factory()->admin()->create();
        $this->signIn($admin);

        $this->travel(20)->minutes();
        $this->autoRefresh();

        $entry = AuditLogEntry::query()->where('action', 'staff.sign_out')->sole();
        $this->assertSame($admin->id, $entry->staff_account_id);
        $this->assertSame(['ended_by' => 'timeout'], $entry->after_values);
    }

    public function test_the_person_can_sign_in_again_after_a_timeout(): void
    {
        $admin = StaffAccount::factory()->admin()->create();
        $this->signIn($admin);
        $this->travel(20)->minutes();
        $this->autoRefresh();

        $this->signIn($admin);

        $this->tap()->assertOk();
    }

    public function test_an_account_deactivated_while_signed_in_is_cut_off_at_once(): void
    {
        $staff = StaffAccount::factory()->create();
        $this->signIn($staff);

        $staff->update(['deactivated_at' => now()]);

        $this->tap()
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'staff_account_deactivated');
        $this->tap()->assertJsonPath('error.code', 'unauthenticated');
    }
}
