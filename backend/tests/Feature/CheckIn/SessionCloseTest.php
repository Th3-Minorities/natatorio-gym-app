<?php

namespace Tests\Feature\CheckIn;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\ScheduleSlot;
use App\Models\StaffAccount;
use App\Models\User;
use App\Services\FacilitySessions;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class SessionCloseTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    public function test_the_scheduled_task_closes_exactly_due_sessions_and_is_idempotent(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $due = FacilitySession::factory()->startedMinutesAgo(120)->create();
        $older = FacilitySession::factory()->startedMinutesAgo(121)->athlete()->create();
        $open = FacilitySession::factory()->startedMinutesAgo(119)->create();
        $finished = FacilitySession::factory()->checkedOut()->create();
        $before = $finished->fresh()->getAttributes();

        // Supply the travelled backend time to the job; the production default is the database clock.
        $this->app->instance(FacilitySessions::class, new class extends FacilitySessions
        {
            public function closeDue(?Carbon $at = null): void
            {
                parent::closeDue(now());
            }
        });
        $this->artisan('schedule:run')->assertSuccessful();
        // Execute the registered scheduler callback, rather than only testing the service in isolation.
        $event = collect(app(Schedule::class)->events())->first(fn ($event) => $event->description === 'close-facility-sessions');
        $this->assertNotNull($event);
        $this->assertSame('* * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertSame('expired', $due->fresh()->status);
        $this->assertSame('expired', $older->fresh()->status);
        $this->assertSame('active', $open->fresh()->status);
        // Automatic expiry uses the stored ends_at, as required by the existing database constraint.
        $this->assertNull($due->fresh()->ended_at);
        $this->assertNull($due->fresh()->checked_out_by_staff_account_id);
        $this->assertSame($before, $finished->fresh()->getAttributes());
        $after = $due->fresh()->getAttributes();
        $this->travel(10)->seconds();
        $event->run($this->app);
        $this->assertSame($after, $due->fresh()->getAttributes());
        $this->assertDatabaseCount('audit_log_entries', 0);
    }

    public function test_term_end_closes_all_active_sessions_including_deleted_authorizations(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 23:59:00', config('app.timezone')));
        $term = AcademicTerm::factory()->create(['starts_on' => '2026-08-01', 'ends_on' => '2026-11-08']);
        $member = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $athlete = FacilitySession::factory()->startedMinutesAgo(40)->athlete()->create();
        $authorization = Authorization::factory()->manual()->create(['academic_term_id' => $term->id]);
        $deleted = FacilitySession::factory()->startedMinutesAgo(50)->create([
            'user_id' => $authorization->user_id, 'authorization_id' => $authorization->id,
        ]);
        $authorization->delete();
        $expiredBeforeMidnight = FacilitySession::factory()->startedMinutesAgo(150)->create();
        $finished = FacilitySession::factory()->checkedOut()->create();
        $before = $finished->fresh()->getAttributes();

        app(FacilitySessions::class)->closeDue(now());
        $this->assertSame('active', $member->fresh()->status);
        $this->travelTo(Carbon::parse('2026-11-09 00:01:00', config('app.timezone')));
        AcademicTerm::factory()->create(['starts_on' => '2026-11-09', 'ends_on' => '2027-02-01']);
        $newVisit = FacilitySession::factory()->startedMinutesAgo(0)->create();
        app(FacilitySessions::class)->closeDue(now());

        foreach ([$member, $athlete, $deleted] as $session) {
            $this->assertSame('closed', $session->fresh()->status);
            $this->assertSame('2026-11-09 00:00:00', $session->fresh()->ended_at->format('Y-m-d H:i:s'));
            $this->assertNull($session->fresh()->checked_out_by_staff_account_id);
        }
        $this->assertNull($deleted->fresh()->authorization_id);
        $this->assertSame('expired', $expiredBeforeMidnight->fresh()->status);
        $this->assertSame('active', $newVisit->fresh()->status);
        $this->assertSame($before, $finished->fresh()->getAttributes());
        $after = $member->fresh()->getAttributes();
        $this->travel(1)->minutes();
        app(FacilitySessions::class)->closeDue(now());
        $this->assertSame($after, $member->fresh()->getAttributes());
        $this->assertDatabaseCount('audit_log_entries', 0);
    }

    public function test_a_delayed_task_preserves_the_first_end_event_and_not_the_run_time(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 23:00:00', config('app.timezone')));
        AcademicTerm::factory()->create(['starts_on' => '2026-08-01', 'ends_on' => '2026-11-08']);
        $automatic = FacilitySession::factory()->startedMinutesAgo(90)->create();
        $termClosed = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $tie = FacilitySession::factory()->startedMinutesAgo(60)->create();
        $this->travelTo(Carbon::parse('2026-11-09 03:00:00', config('app.timezone')));

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('expired', $automatic->fresh()->status);
        $this->assertSame('closed', $termClosed->fresh()->status);
        $this->assertSame('closed', $tie->fresh()->status);
        $this->assertSame('2026-11-09 00:00:00', $termClosed->fresh()->ended_at->format('Y-m-d H:i:s'));
    }

    #[DataProvider('endReasons')]
    public function test_the_user_gets_the_latest_end_reason_and_times(string $status): void
    {
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $session = FacilitySession::factory()->startedMinutesAgo(150)->create([
            'user_id' => $user->id, 'status' => $status,
            'ended_at' => $status === 'expired' ? null : now()->subMinutes(140),
        ]);
        $expectedEnd = $status === 'expired' ? $session->ends_at : $session->ended_at;
        FacilitySession::factory()->checkedOut()->create();

        $response = $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa()
            ->getJson('/api/user/check-in')->assertOk()
            ->assertJsonPath('session', null)
            ->assertJsonPath('last_session.id', $session->id)
            ->assertJsonPath('last_session.end_reason', $status === 'ended_early' ? 'checked_out' : $status)
            ->assertJsonPath('last_session.started_at', $session->started_at->toISOString())
            ->assertJsonPath('last_session.ended_at', $expectedEnd->toISOString());
        $this->assertSame(['id', 'started_at', 'ended_at', 'end_reason'], array_keys($response->json('last_session')));
    }

    public static function endReasons(): array
    {
        return array_map(fn ($status) => [$status], ['checked_out', 'expired', 'closed', 'ended_early']);
    }

    public function test_an_expired_session_is_reported_before_the_task_runs(): void
    {
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $session = FacilitySession::factory()->startedMinutesAgo(121)->create(['user_id' => $user->id]);

        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa()
            ->getJson('/api/user/check-in')->assertOk()->assertJsonPath('session', null)
            ->assertJsonPath('last_session.end_reason', 'expired')
            ->assertJsonPath('last_session.ended_at', $session->ends_at->toISOString());
        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_term_end_is_effective_for_reads_before_the_task_runs(): void
    {
        $midnight = today();
        AcademicTerm::factory()->create(['starts_on' => $midnight->copy()->subMonth(), 'ends_on' => $midnight->copy()->subDay()]);
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $session = FacilitySession::factory()->athlete()->create([
            'user_id' => $user->id, 'started_at' => $midnight->copy()->subMinutes(20),
            'ends_at' => $midnight->copy()->addMinutes(100),
        ]);

        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa()
            ->getJson('/api/user/check-in')->assertOk()->assertJsonPath('session', null)
            ->assertJsonPath('last_session.end_reason', 'closed')
            ->assertJsonPath('last_session.ended_at', $midnight->toISOString());
        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_term_end_is_effective_for_check_out_before_the_task_runs(): void
    {
        $midnight = today();
        AcademicTerm::factory()->create(['starts_on' => $midnight->copy()->subMonth(), 'ends_on' => $midnight->copy()->subDay()]);
        $session = FacilitySession::factory()->athlete()->create([
            'started_at' => $midnight->copy()->subMinutes(20), 'ends_at' => $midnight->copy()->addMinutes(100),
        ]);

        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")->assertConflict();
        $this->assertSame('active', $session->fresh()->status);
    }

    /** Created now unless $createdAt says when it was published. */
    private function closure(string $startsAt, string $endsAt, ?string $createdAt = null): ScheduleSlot
    {
        $zone = config('app.timezone');

        return ScheduleSlot::factory()->dated()->create([
            'starts_at' => Carbon::parse($startsAt, $zone), 'ends_at' => Carbon::parse($endsAt, $zone),
            'created_at' => Carbon::parse($createdAt ?? now(), $zone),
        ]);
    }

    public function test_a_closure_that_starts_during_a_visit_closes_it_at_the_closure_start(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $this->closure('2026-11-08 12:10:00', '2026-11-08 14:00:00');
        $this->travelTo(Carbon::parse('2026-11-08 12:20:00', config('app.timezone')));

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('closed', $session->fresh()->status);
        $this->assertSame('2026-11-08 12:10:00', $session->fresh()->ended_at->format('Y-m-d H:i:s'));
        $this->assertNull($session->fresh()->checked_out_by_staff_account_id);
        $after = $session->fresh()->getAttributes();
        $this->travel(1)->minutes();
        app(FacilitySessions::class)->closeDue(now());
        $this->assertSame($after, $session->fresh()->getAttributes());
    }

    public function test_a_weekly_row_and_a_closure_before_the_visit_do_not_close_it(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $this->closure('2026-11-08 09:00:00', '2026-11-08 11:00:00', '2026-11-08 09:00:00');
        ScheduleSlot::factory()->create(['type' => 'regular_hours']);

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_a_closure_that_starts_after_the_visit_expired_leaves_it_expired(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $this->closure('2026-11-08 14:00:00', '2026-11-08 16:00:00');
        $this->travelTo(Carbon::parse('2026-11-08 14:30:00', config('app.timezone')));

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('expired', $session->fresh()->status);
        $this->assertNull($session->fresh()->ended_at);
    }

    public function test_a_closure_before_the_term_end_wins_and_one_after_it_does_not(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 23:00:00', config('app.timezone')));
        AcademicTerm::factory()->create(['starts_on' => '2026-08-01', 'ends_on' => '2026-11-08']);
        $beforeTermEnd = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $this->closure('2026-11-08 23:30:00', '2026-11-08 23:40:00');
        $this->travelTo(Carbon::parse('2026-11-08 23:50:00', config('app.timezone')));
        $afterTermEnd = FacilitySession::factory()->startedMinutesAgo(0)->create();
        $this->closure('2026-11-09 00:15:00', '2026-11-09 02:00:00');
        $this->travelTo(Carbon::parse('2026-11-09 01:00:00', config('app.timezone')));

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('closed', $beforeTermEnd->fresh()->status);
        $this->assertSame('2026-11-08 23:30:00', $beforeTermEnd->fresh()->ended_at->format('Y-m-d H:i:s'));
        $this->assertSame('closed', $afterTermEnd->fresh()->status);
        $this->assertSame('2026-11-09 00:00:00', $afterTermEnd->fresh()->ended_at->format('Y-m-d H:i:s'));
    }

    public function test_a_closure_that_had_already_started_when_published_ends_the_visit_at_once(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $this->travelTo(Carbon::parse('2026-11-08 12:30:00', config('app.timezone')));
        app(FacilitySessions::class)->closeDue(now());
        $this->assertSame('active', $session->fresh()->status);

        $this->closure('2026-11-08 11:45:00', '2026-11-08 14:00:00');
        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('closed', $session->fresh()->status);
        $this->assertSame('2026-11-08 12:30:00', $session->fresh()->ended_at->format('Y-m-d H:i:s'));
    }

    public function test_a_closure_published_after_it_started_ends_a_visit_at_the_publish_time(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $session = FacilitySession::factory()->startedMinutesAgo(15)->create();
        $closure = $this->closure('2026-11-08 11:30:00', '2026-11-08 14:00:00', '2026-11-08 12:00:00');

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('closed', $session->fresh()->status);
        $this->assertEquals($closure->created_at, $session->fresh()->ended_at);
        $this->assertSame('2026-11-08 12:00:00', $session->fresh()->ended_at->format('Y-m-d H:i:s'));
    }

    public function test_a_closure_that_was_already_over_when_published_does_not_end_a_visit(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create();
        $this->closure('2026-11-08 09:00:00', '2026-11-08 11:00:00', '2026-11-08 12:00:00');

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_a_visit_that_began_during_a_closure_published_earlier_is_not_ended_by_it(): void
    {
        $this->travelTo(Carbon::parse('2026-11-08 12:00:00', config('app.timezone')));
        $this->closure('2026-11-08 11:30:00', '2026-11-08 14:00:00', '2026-11-08 11:00:00');
        $session = FacilitySession::factory()->startedMinutesAgo(15)->create();

        app(FacilitySessions::class)->closeDue(now());

        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_a_started_closure_is_effective_for_reads_before_the_task_runs(): void
    {
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $user->id]);
        $closure = ScheduleSlot::factory()->dated()->create([
            'starts_at' => now()->subMinutes(10), 'ends_at' => now()->addHour(), 'created_at' => now()->subMinutes(10),
        ]);

        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa()
            ->getJson('/api/user/check-in')->assertOk()->assertJsonPath('session', null)
            ->assertJsonPath('last_session.id', $session->id)
            ->assertJsonPath('last_session.end_reason', 'closed')
            ->assertJsonPath('last_session.ended_at', $closure->fresh()->starts_at->toISOString());
        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_a_started_closure_is_effective_for_check_out_before_the_task_runs(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create();
        ScheduleSlot::factory()->dated()->create([
            'starts_at' => now()->subMinutes(10), 'ends_at' => now()->addHour(), 'created_at' => now()->subMinutes(10),
        ]);

        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$session->id}/check-out")->assertConflict();
        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_a_closure_scheduled_for_later_leaves_a_current_visit_active(): void
    {
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $user->id]);
        ScheduleSlot::factory()->dated()->create(['starts_at' => now()->addMinutes(10), 'ends_at' => now()->addHour()]);

        app(FacilitySessions::class)->closeDue();

        $this->assertSame('active', $session->fresh()->status);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa()
            ->getJson('/api/user/check-in')->assertOk()->assertJsonPath('session.id', $session->id);
    }
}
