<?php

namespace Tests\Feature\CheckIn;

use App\Models\FacilitySession;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class CheckOutTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    #[DataProvider('staffRoles')]
    public function test_staff_and_administrators_check_out_without_an_audit_entry(string $role): void
    {
        $staff = StaffAccount::factory()->create(['role' => $role]);
        $session = FacilitySession::factory()->startedMinutesAgo(20)->create();
        $before = Carbon::parse(DB::selectOne('SELECT clock_timestamp() AS time')->time);

        $response = $this->actingAs($staff, 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")
            ->assertOk()->assertJsonPath('session.status', 'checked_out')
            ->assertJsonPath('session.end_reason', 'checked_out');

        $session->refresh();
        $response->assertJsonPath('session.ended_at', $session->ended_at->toISOString());
        $this->assertSame('checked_out', $session->status);
        $after = Carbon::parse(DB::selectOne('SELECT clock_timestamp() AS time')->time);
        $this->assertEndedBetween($session->ended_at, $before, $after);
        $this->assertSame($staff->id, $session->checked_out_by_staff_account_id);
        $this->assertDatabaseCount('audit_log_entries', 0);
    }

    public static function staffRoles(): array
    {
        return [['staff'], ['admin']];
    }

    #[DataProvider('endedStates')]
    public function test_only_active_sessions_can_be_checked_out(string $status): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(150)->create([
            'status' => $status,
            'ended_at' => in_array($status, ['checked_out', 'closed', 'ended_early', 'void'], true)
                ? now()->subMinutes(140) : null,
        ]);
        $before = $session->fresh()->getAttributes();

        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")
            ->assertConflict()->assertJsonPath('error.code', 'conflict');

        $this->assertSame($before, $session->fresh()->getAttributes());
        $this->assertDatabaseCount('audit_log_entries', 0);
    }

    public static function endedStates(): array
    {
        return array_map(fn ($status) => [$status], ['active', 'expired', 'checked_out', 'closed', 'ended_early', 'void']);
    }

    public function test_exactly_two_hours_is_already_ended(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(120)->create();

        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")->assertConflict();
    }

    public function test_a_second_check_out_cannot_change_the_first_staff_or_end_time(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(20)->create();
        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")->assertOk();
        $before = $session->fresh()->getAttributes();

        $this->actingAs(StaffAccount::factory()->create(), 'staff')
            ->postJson("/api/staff/sessions/{$session->id}/check-out")->assertConflict();

        $this->assertSame($before, $session->fresh()->getAttributes());
    }

    public function test_guests_and_user_accounts_cannot_check_out(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(10)->create();
        $this->fromThePwa()->postJson("/api/staff/sessions/{$session->id}/check-out")
            ->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
        $this->actingAs(User::factory()->create(), 'web')
            ->postJson("/api/staff/sessions/{$session->id}/check-out")
            ->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');

        $this->assertSame('active', $session->fresh()->status);
    }

    #[DataProvider('badIds')]
    public function test_session_ids_are_rejected_before_a_database_lookup(string $id, int $status): void
    {
        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson('/api/staff/sessions/'.rawurlencode($id).'/check-out')
            ->assertStatus($status);
        $this->assertDatabaseCount('facility_sessions', 0);
    }

    public static function badIds(): array
    {
        return [['1 OR 1=1', 404], ["1'; DROP TABLE facility_sessions; --", 404], ['<script>alert(1)</script>', 404],
            ['0', 422], ['999999999999999999999999999999', 422]];
    }

    public function test_an_unknown_session_returns_not_found(): void
    {
        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson('/api/staff/sessions/999999/check-out')
            ->assertNotFound()->assertJsonPath('error.code', 'not_found');
    }

    public function test_body_fields_cannot_set_the_staff_time_reason_or_session(): void
    {
        $staff = StaffAccount::factory()->create();
        $session = FacilitySession::factory()->startedMinutesAgo(10)->create();
        $other = FacilitySession::factory()->startedMinutesAgo(10)->create();
        $before = Carbon::parse(DB::selectOne('SELECT clock_timestamp() AS time')->time);

        $this->actingAs($staff, 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out", [
                'session_id' => "{$other->id} OR 1=1",
                'checked_out_by_staff_account_id' => "1'; DROP TABLE staff_accounts; --",
                'ended_at' => '<script>alert(1)</script>',
                'status' => 'active', 'end_reason' => '<script>alert(1)</script>',
            ])->assertOk()->assertJsonPath('session.end_reason', 'checked_out');

        $this->assertSame($staff->id, $session->fresh()->checked_out_by_staff_account_id);
        $after = Carbon::parse(DB::selectOne('SELECT clock_timestamp() AS time')->time);
        $this->assertEndedBetween($session->fresh()->ended_at, $before, $after);
        $this->assertSame('active', $other->fresh()->status);
        $this->assertDatabaseCount('facility_sessions', 2);
        $this->assertDatabaseCount('staff_accounts', 1);
    }

    public function test_check_out_uses_database_time_even_if_the_php_clock_differs(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(10)->create();
        $before = Carbon::parse(DB::selectOne('SELECT clock_timestamp() AS time')->time);
        $this->travel(6)->hours();

        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")->assertOk();

        $after = Carbon::parse(DB::selectOne('SELECT clock_timestamp() AS time')->time);
        $this->assertEndedBetween($session->fresh()->ended_at, $before, $after);
    }

    public function test_a_new_session_with_database_fractional_seconds_can_be_checked_out(): void
    {
        $session = FacilitySession::factory()->create();

        $response = $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")
            ->assertOk()->assertJsonPath('session.status', 'checked_out');

        $this->assertTrue($session->fresh()->ended_at->greaterThanOrEqualTo($session->fresh()->started_at));
        $response->assertJsonPath('session.ended_at', $session->fresh()->ended_at->toISOString());
    }

    /** ended_at is timestamptz(0): PostgreSQL rounds the clock reading to the nearest second. */
    private function assertEndedBetween(Carbon $endedAt, Carbon $before, Carbon $after): void
    {
        $this->assertTrue($endedAt->betweenIncluded($before->copy()->subSecond(), $after->copy()->addSecond()));
    }
}
