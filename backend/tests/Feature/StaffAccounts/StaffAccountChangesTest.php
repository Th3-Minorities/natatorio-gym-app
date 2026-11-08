<?php

namespace Tests\Feature\StaffAccounts;

use App\Exceptions\ApiException;
use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use App\Services\StaffAccountChanges;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** An Administrator changes a role, deactivates and reactivates staff accounts (REQ-F-88, E-130, E-150, E-151, A-15). */
class StaffAccountChangesTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private StaffAccount $admin;

    private StaffAccount $staff;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = StaffAccount::factory()->admin()->create();
        $this->staff = StaffAccount::factory()->create(['name' => 'Mariel Vélez Soto']);
    }

    private function asAdmin(string $method, string $uri, array $data = []): TestResponse
    {
        return $this->actingAs($this->admin, 'staff')->fromThePwa()->json($method, $uri, $data);
    }

    /** The service refuses with this code and status, whoever calls it. */
    private function assertRefused(callable $change, string $code, int $status): void
    {
        try {
            $change();
            $this->fail("Expected {$code}.");
        } catch (ApiException $e) {
            $this->assertSame($code, $e->errorCode);
            $this->assertSame($status, $e->status);
        }
    }

    // Change role

    public function test_an_administrator_changes_a_role_and_the_log_keeps_both_roles(): void
    {
        $this->asAdmin('PATCH', "/api/staff/accounts/{$this->staff->id}/role", ['role' => 'admin'])
            ->assertOk()->assertJsonPath('account.role', 'admin');

        $this->assertSame('admin', $this->staff->fresh()->role);
        $entry = AuditLogEntry::query()->where('action', 'staff.role_change')->sole();
        $this->assertSame(['role' => 'staff'], $entry->before_values);
        $this->assertSame(['role' => 'admin'], $entry->after_values);
        $this->assertSame($this->staff->id, $entry->subject_id);
    }

    public function test_the_new_role_applies_on_the_next_request(): void
    {
        $signIn = $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $this->staff->email, 'password' => 'password'])->assertOk();
        $this->keepingTheSessionOf($signIn)->getJson('/api/staff/accounts')->assertForbidden();

        $this->asAdmin('PATCH', "/api/staff/accounts/{$this->staff->id}/role", ['role' => 'admin'])->assertOk();

        $this->keepingTheSessionOf($signIn)->getJson('/api/staff/accounts')->assertOk();
    }

    public function test_a_demotion_takes_effect_on_the_next_request(): void
    {
        $other = StaffAccount::factory()->admin()->create();
        $signIn = $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $other->email, 'password' => 'password'])->assertOk();
        $this->keepingTheSessionOf($signIn)->getJson('/api/staff/accounts')->assertOk();

        $this->asAdmin('PATCH', "/api/staff/accounts/{$other->id}/role", ['role' => 'staff'])->assertOk();

        $this->keepingTheSessionOf($signIn)->getJson('/api/staff/accounts')->assertForbidden();
    }

    public function test_the_last_active_administrator_is_never_demoted(): void
    {
        // Same rule as deactivating: through the screen the one acting always stays, and two Administrators
        // acting at once are caught by the locked check. An invited or deactivated Administrator does not count.
        StaffAccount::factory()->admin()->create(['password' => null]);
        StaffAccount::factory()->admin()->deactivated()->create();

        $this->assertRefused(
            fn () => app(StaffAccountChanges::class)->changeRole($this->admin, $this->admin, 'staff'),
            'staff_last_administrator', 409,
        );
        $this->assertSame('admin', $this->admin->fresh()->role);
        $this->assertSame(0, AuditLogEntry::query()->count());
    }

    public function test_nobody_changes_their_own_role(): void
    {
        $this->asAdmin('PATCH', "/api/staff/accounts/{$this->admin->id}/role", ['role' => 'staff'])
            ->assertConflict()->assertJsonPath('error.code', 'staff_role_own_account');
        $this->assertSame('admin', $this->admin->fresh()->role);
    }

    public function test_the_same_role_changes_nothing_and_logs_nothing(): void
    {
        $this->asAdmin('PATCH', "/api/staff/accounts/{$this->staff->id}/role", ['role' => 'staff'])->assertOk();
        $this->assertSame(0, AuditLogEntry::query()->where('action', 'staff.role_change')->count());
    }

    public function test_only_active_accounts_change_role(): void
    {
        $invited = StaffAccount::factory()->create(['password' => null]);
        $deactivated = StaffAccount::factory()->deactivated()->create();

        foreach ([$invited, $deactivated] as $account) {
            $this->asAdmin('PATCH', "/api/staff/accounts/{$account->id}/role", ['role' => 'admin'])
                ->assertConflict()->assertJsonPath('error.code', 'staff_account_status_changed');
            $this->assertSame('staff', $account->fresh()->role);
        }
    }

    public function test_the_role_is_checked_on_the_server(): void
    {
        foreach (['owner', '', "admin' OR '1'='1", ['admin']] as $role) {
            $this->asAdmin('PATCH', "/api/staff/accounts/{$this->staff->id}/role", ['role' => $role])
                ->assertUnprocessable()->assertJsonPath('error.code', 'validation_failed');
        }
        $this->assertSame('staff', $this->staff->fresh()->role);
    }

    // Deactivate

    public function test_deactivating_keeps_the_account_and_ends_its_sign_in_at_once(): void
    {
        $signIn = $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $this->staff->email, 'password' => 'password'])->assertOk();

        $this->asAdmin('POST', "/api/staff/accounts/{$this->staff->id}/deactivate")
            ->assertOk()->assertJsonPath('account.status', 'deactivated');

        $this->assertNotNull($this->staff->fresh()->deactivated_at);
        $this->keepingTheSessionOf($signIn)->getJson('/api/staff/me')
            ->assertUnauthorized()->assertJsonPath('error.code', 'staff_account_deactivated');

        $entry = AuditLogEntry::query()->where('action', 'staff.deactivate')->sole();
        $this->assertSame($this->staff->id, $entry->subject_id);
        $this->assertSame(['status' => 'active'], $entry->before_values);
        $this->assertSame(['status' => 'deactivated'], $entry->after_values);
    }

    public function test_a_sign_in_made_before_a_deactivation_stays_ended_after_the_reactivation(): void
    {
        $signIn = $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $this->staff->email, 'password' => 'password'])->assertOk();

        $this->asAdmin('POST', "/api/staff/accounts/{$this->staff->id}/deactivate")->assertOk();
        $this->asAdmin('POST', "/api/staff/accounts/{$this->staff->id}/reactivate")->assertOk();

        // The old sign-in made no request in between, so only the account itself can tell it ended.
        $this->keepingTheSessionOf($signIn)->getJson('/api/staff/me')
            ->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
        $again = $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $this->staff->email, 'password' => 'password'])->assertOk();
        $this->keepingTheSessionOf($again)->getJson('/api/staff/me')->assertOk();
    }

    public function test_an_invitation_can_be_withdrawn_by_deactivating(): void
    {
        $invited = StaffAccount::factory()->create(['password' => null]);

        $this->asAdmin('POST', "/api/staff/accounts/{$invited->id}/deactivate")->assertOk();
        $entry = AuditLogEntry::query()->where('action', 'staff.deactivate')->sole();
        $this->assertSame(['status' => 'invited'], $entry->before_values);
    }

    public function test_nobody_deactivates_their_own_account(): void
    {
        StaffAccount::factory()->admin()->create();

        $this->asAdmin('POST', "/api/staff/accounts/{$this->admin->id}/deactivate")
            ->assertConflict()->assertJsonPath('error.code', 'staff_deactivate_own_account');
        $this->assertNull($this->admin->fresh()->deactivated_at);
    }

    public function test_deactivating_another_administrator_leaves_the_one_acting(): void
    {
        $other = StaffAccount::factory()->admin()->create();

        $this->asAdmin('POST', "/api/staff/accounts/{$other->id}/deactivate")->assertOk();
        $this->assertNotNull($other->fresh()->deactivated_at);
    }

    public function test_the_last_active_administrator_is_never_deactivated(): void
    {
        // Through the screen the one acting always stays, since nobody deactivates their own account. Two
        // Administrators deactivating each other at the same moment could still leave none, so the rule
        // runs again on locked rows. An invited or deactivated Administrator cannot sign in and does not count.
        $last = StaffAccount::factory()->admin()->create();
        StaffAccount::factory()->admin()->create(['password' => null]);
        StaffAccount::factory()->admin()->deactivated()->create();
        $this->admin->forceFill(['deactivated_at' => now()])->save();

        try {
            app(StaffAccountChanges::class)->deactivate($last, $last);
            $this->fail('The last active Administrator was deactivated.');
        } catch (ApiException $e) {
            $this->assertSame('staff_last_administrator', $e->errorCode);
            $this->assertSame(409, $e->status);
        }
        $this->assertNull($last->fresh()->deactivated_at);
    }

    public function test_an_account_already_deactivated_is_not_deactivated_again(): void
    {
        $deactivated = StaffAccount::factory()->deactivated()->create();

        $this->asAdmin('POST', "/api/staff/accounts/{$deactivated->id}/deactivate")
            ->assertConflict()->assertJsonPath('error.code', 'staff_account_status_changed');
        $this->assertSame(0, AuditLogEntry::query()->count());
    }

    // Reactivate

    public function test_reactivating_lets_the_person_sign_in_with_the_same_password(): void
    {
        $this->staff->forceFill(['deactivated_at' => now()])->save();

        $this->asAdmin('POST', "/api/staff/accounts/{$this->staff->id}/reactivate")
            ->assertOk()->assertJsonPath('account.status', 'active');

        $this->fromThePwa()->postJson('/api/staff/sign-in', ['email' => $this->staff->email, 'password' => 'password'])->assertOk();
        $entry = AuditLogEntry::query()->where('action', 'staff.reactivate')->sole();
        $this->assertSame(['status' => 'deactivated'], $entry->before_values);
        $this->assertSame(['status' => 'active'], $entry->after_values);
    }

    public function test_a_withdrawn_invitation_comes_back_as_invited(): void
    {
        $invited = StaffAccount::factory()->deactivated()->create(['password' => null]);

        $this->asAdmin('POST', "/api/staff/accounts/{$invited->id}/reactivate")
            ->assertOk()->assertJsonPath('account.status', 'invited');
    }

    public function test_only_deactivated_accounts_are_reactivated(): void
    {
        $this->asAdmin('POST', "/api/staff/accounts/{$this->staff->id}/reactivate")
            ->assertConflict()->assertJsonPath('error.code', 'staff_account_status_changed');
    }

    // Who may do it

    public function test_two_administrators_cannot_demote_or_deactivate_each_other_at_once(): void
    {
        // The second change reached the server while the first held the locks. Run in order, the second
        // finds its Administrator already gone and is refused, so one active Administrator is left.
        $other = StaffAccount::factory()->admin()->create();
        $changes = app(StaffAccountChanges::class);

        $changes->changeRole($this->admin, $other, 'staff');
        $this->assertRefused(fn () => $changes->changeRole($other, $this->admin, 'staff'), 'forbidden', 403);
        $this->assertRefused(fn () => $changes->deactivate($other, $this->admin), 'forbidden', 403);
        $this->assertSame('admin', $this->admin->fresh()->role);
        $this->assertNull($this->admin->fresh()->deactivated_at);

        $third = StaffAccount::factory()->admin()->create();
        $changes->deactivate($this->admin, $third);
        $this->assertRefused(fn () => $changes->changeRole($third, $this->admin, 'staff'), 'forbidden', 403);
        $this->assertRefused(fn () => $changes->reactivate($third, $third), 'forbidden', 403);
        $this->assertSame('admin', $this->admin->fresh()->role);
    }

    public function test_an_administrator_who_lost_the_role_after_the_request_began_is_refused(): void
    {
        // The route middleware read the old role; the change reads it again on the locked rows.
        StaffAccount::query()->whereKey($this->admin->id)->update(['role' => 'staff']);
        $deactivated = StaffAccount::factory()->deactivated()->create();

        $this->asAdmin('PATCH', "/api/staff/accounts/{$this->staff->id}/role", ['role' => 'admin'])
            ->assertForbidden()->assertJsonPath('error.code', 'forbidden');
        $this->asAdmin('POST', "/api/staff/accounts/{$this->staff->id}/deactivate")->assertForbidden();
        $this->asAdmin('POST', "/api/staff/accounts/{$deactivated->id}/reactivate")->assertForbidden();

        $this->assertSame('staff', $this->staff->fresh()->role);
        $this->assertNull($this->staff->fresh()->deactivated_at);
        $this->assertNotNull($deactivated->fresh()->deactivated_at);
        $this->assertSame(0, AuditLogEntry::query()->count());
    }

    public function test_staff_are_forbidden_every_change(): void
    {
        $other = StaffAccount::factory()->create();
        $this->actingAs($this->staff, 'staff')->fromThePwa();

        $this->patchJson("/api/staff/accounts/{$other->id}/role", ['role' => 'admin'])->assertForbidden();
        $this->postJson("/api/staff/accounts/{$other->id}/deactivate")->assertForbidden();
        $this->postJson("/api/staff/accounts/{$other->id}/reactivate")->assertForbidden();
        $this->assertSame('staff', $other->fresh()->role);
        $this->assertNull($other->fresh()->deactivated_at);
    }

    public function test_an_unknown_account_is_not_found(): void
    {
        $this->asAdmin('POST', '/api/staff/accounts/999999/deactivate')->assertNotFound();
        $this->asAdmin('PATCH', '/api/staff/accounts/x/role', ['role' => 'admin'])->assertNotFound();
    }
}
