<?php

namespace Tests\Feature\CheckIn;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\ScheduleSlot;
use App\Models\StaffAccount;
use App\Models\User;
use App\Support\GymBoundary;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** Check In with location (REQ-F-33, REQ-F-36, REQ-F-37, REQ-F-82, REQ-F-83, REQ-NF-03; check-in-flows D1, D3). */
class CheckInTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    /** A point about 11 m north of the center: inside the boundary. */
    private const INSIDE = ['latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER + 0.0001, 'longitude' => GymBoundary::GYM_LONGITUDE_PLACEHOLDER, 'accuracy' => 10];

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        config(['check_in.radius_meters' => 50, 'check_in.max_accuracy_meters' => 30]);
        $this->user = User::factory()->create(['current_session_id' => 'current-device']);
        $this->actingAs($this->user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa();
    }

    private function term(): AcademicTerm
    {
        return AcademicTerm::query()->first()
            ?? AcademicTerm::factory()->create(['starts_on' => today()->subMonth(), 'ends_on' => today()->addMonth()]);
    }

    private function authorize(string $type = 'paid', array $attributes = []): Authorization
    {
        return Authorization::factory()->{$type}()->create(['user_id' => $this->user->id, 'academic_term_id' => $this->term()->id, ...$attributes]);
    }

    private function slot(string $type, Carbon $startsAt, Carbon $endsAt): void
    {
        ScheduleSlot::factory()->create([
            'type' => $type, 'weekday' => null, 'start_time' => null, 'end_time' => null, 'starts_at' => $startsAt, 'ends_at' => $endsAt,
        ]);
    }

    private function open(): void
    {
        $this->slot('regular_hours', now()->subHour(), now()->addHours(4));
    }

    private function assertRejected(string $code, int $status, array $body = self::INSIDE): void
    {
        $this->postJson('/api/user/check-in', $body)->assertStatus($status)->assertJsonPath('error.code', $code);
        $this->assertDatabaseCount('facility_sessions', 0);
    }

    public function test_get_without_a_session(): void
    {
        $this->authorize('athlete');

        $this->getJson('/api/user/check-in')->assertOk()
            ->assertExactJson(['session' => null, 'athletes_period' => null, 'last_session' => null, 'account_type' => 'athlete', 'member_group' => null, 'sport' => Authorization::query()->sole()->rosterRecord->sport]);
    }

    public function test_get_without_an_authorization_has_no_account_type(): void
    {
        $this->getJson('/api/user/check-in')->assertOk()->assertJsonPath('account_type', null);
    }

    public function test_account_type_comes_from_the_latest_authorization_in_any_term_or_status(): void
    {
        $old = AcademicTerm::factory()->create(['starts_on' => today()->subYear(), 'ends_on' => today()->subMonths(9)]);
        $ended = AcademicTerm::factory()->create(['starts_on' => today()->subMonths(6), 'ends_on' => today()->subMonths(2)]);
        Authorization::factory()->manual()->create(['user_id' => $this->user->id, 'academic_term_id' => $old->id]);
        Authorization::factory()->athlete()->create(['user_id' => $this->user->id, 'academic_term_id' => $ended->id, 'status' => 'revoked']);

        $this->getJson('/api/user/check-in')->assertOk()->assertJsonPath('account_type', 'athlete')->assertJsonPath('member_group', null);
    }

    public function test_member_group_comes_from_the_order_or_the_manual_grant(): void
    {
        $this->authorize('paid')->importedMembership->update(['member_group' => 'employee']);
        $this->getJson('/api/user/check-in')->assertJsonPath('account_type', 'member')->assertJsonPath('member_group', 'employee')
            ->assertJsonPath('sport', null);

        Authorization::query()->delete();
        $this->authorize('manual', ['member_group' => 'student']);
        $this->getJson('/api/user/check-in')->assertJsonPath('member_group', 'student');
    }

    public function test_an_active_session_is_returned_even_with_bad_location_numbers(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(10)->create(['user_id' => $this->user->id]);

        $this->postJson('/api/user/check-in', ['latitude' => 999, 'longitude' => 'x', 'accuracy' => -1])
            ->assertOk()->assertJsonPath('session.id', $session->id);
    }

    public function test_a_valid_check_in_creates_one_session_with_the_authorization_copied(): void
    {
        $authorization = $this->authorize();
        $this->open();

        $response = $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated()
            ->assertJsonPath('session.status', 'active')->assertJsonPath('account_type', 'member');

        $session = FacilitySession::query()->sole();
        $response->assertJsonPath('session.id', $session->id)->assertJsonPath('session.started_at', $session->started_at->toISOString());
        $this->assertSame($this->user->id, $session->user_id);
        $this->assertSame($authorization->id, $session->authorization_id);
        $this->assertSame('paid', $session->authorization_type);
        $this->assertSame($authorization->importedMembership->member_group, $session->member_group);
        $this->assertFalse($session->assisted);
    }

    public function test_an_athlete_session_copies_the_sport(): void
    {
        $authorization = $this->authorize('athlete');
        $this->open();

        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated()->assertJsonPath('sport', $authorization->rosterRecord->sport);

        $this->assertSame($authorization->rosterRecord->sport, FacilitySession::query()->sole()->sport);
    }

    public function test_an_active_session_is_returned_without_location_or_any_other_check(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $this->user->id]);

        $this->postJson('/api/user/check-in')->assertOk()->assertJsonPath('session.id', $session->id);
        $this->getJson('/api/user/check-in')->assertOk()->assertJsonPath('session.id', $session->id);
        $this->assertDatabaseCount('facility_sessions', 1);
    }

    public function test_a_session_past_its_two_hours_is_not_active_even_before_the_cleanup_task(): void
    {
        FacilitySession::factory()->startedMinutesAgo(150)->create(['user_id' => $this->user->id]);
        $this->authorize();
        $this->open();

        $this->getJson('/api/user/check-in')->assertJsonPath('session', null)
            ->assertJsonPath('last_session.end_reason', 'expired');
        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated();
    }

    public function test_a_later_void_visit_does_not_hide_the_active_session(): void
    {
        $active = FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $this->user->id]);
        FacilitySession::factory()->startedMinutesAgo(10)->checkedOut(5)->create([
            'user_id' => $this->user->id, 'status' => 'void',
        ]);

        $this->getJson('/api/user/check-in')->assertOk()->assertJsonPath('session.id', $active->id);
        $this->postJson('/api/user/check-in')->assertOk()->assertJsonPath('session.id', $active->id);
        $this->assertDatabaseCount('facility_sessions', 2);
    }

    public function test_a_history_with_only_void_visits_has_no_last_session(): void
    {
        FacilitySession::factory()->startedMinutesAgo(60)->checkedOut(20)->create([
            'user_id' => $this->user->id, 'status' => 'void',
        ]);

        $this->getJson('/api/user/check-in')->assertOk()
            ->assertJsonPath('session', null)->assertJsonPath('last_session', null);
    }

    public function test_the_active_session_keeps_its_original_shape_and_last_session_is_the_previous_visit(): void
    {
        $previous = FacilitySession::factory()->startedMinutesAgo(200)->checkedOut(20)->create(['user_id' => $this->user->id]);
        $active = FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $this->user->id]);

        $response = $this->getJson('/api/user/check-in')->assertOk()
            ->assertJsonPath('session.id', $active->id)->assertJsonPath('last_session.id', $previous->id);
        $this->assertSame(['id', 'started_at', 'status'], array_keys($response->json('session')));
        $this->assertSame(['id', 'started_at', 'ended_at', 'end_reason'], array_keys($response->json('last_session')));
    }

    public function test_a_check_in_after_a_closure_ended_the_visit_before_the_task_ran_is_created(): void
    {
        $old = FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $this->user->id]);
        ScheduleSlot::factory()->dated()->create([
            'starts_at' => now()->subMinutes(10), 'ends_at' => now()->subMinutes(5), 'created_at' => now()->subMinutes(10),
        ]);
        $this->authorize();
        $this->open();

        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated();

        $this->assertSame('closed', $old->fresh()->status);
        $this->assertNotNull($old->fresh()->ended_at);
        $this->assertSame(1, FacilitySession::query()->where('status', 'active')->count());
    }

    public function test_a_checked_out_session_allows_a_new_check_in(): void
    {
        FacilitySession::factory()->startedMinutesAgo(60)->checkedOut(20)->create(['user_id' => $this->user->id]);
        $this->authorize();
        $this->open();

        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated();
        $this->assertSame(1, FacilitySession::query()->where('status', 'active')->count());
    }

    public function test_no_authorization(): void
    {
        $this->open();
        $this->assertRejected('check_in_no_authorization', 403);
    }

    public function test_a_revoked_or_ended_authorization_is_no_authorization(): void
    {
        $this->open();
        $this->authorize('paid', ['status' => 'revoked']);
        $ended = AcademicTerm::factory()->create(['starts_on' => today()->subMonths(6), 'ends_on' => today()->subMonths(2)]);
        Authorization::factory()->manual()->create(['user_id' => $this->user->id, 'academic_term_id' => $ended->id]);

        $this->assertRejected('check_in_no_authorization', 403);
    }

    public function test_photo_required(): void
    {
        $this->open();
        $this->authorize('athlete', ['photo_path' => null]);
        $this->assertRejected('check_in_photo_required', 409);
    }

    public function test_photo_pending(): void
    {
        $this->open();
        $this->authorize('paid', ['photo_pending_at' => now()]);
        $this->assertRejected('check_in_photo_pending', 409);
    }

    public function test_gym_closed_with_no_hours_now(): void
    {
        $this->authorize();
        $this->slot('regular_hours', now()->addHour(), now()->addHours(3));
        $this->assertRejected('check_in_gym_closed', 409);
    }

    public function test_a_closure_wins_over_regular_hours(): void
    {
        $this->authorize();
        $this->open();
        $this->slot('closure', now()->subMinutes(10), now()->addHour());
        $this->assertRejected('check_in_gym_closed', 409);
    }

    public function test_weekly_regular_hours_open_the_gym(): void
    {
        $this->travelTo(Carbon::parse('2026-11-11 10:00', 'America/Puerto_Rico'));
        $this->authorize();
        ScheduleSlot::factory()->create(['weekday' => 3, 'start_time' => '06:00', 'end_time' => '22:00']);

        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated();
    }

    public function test_weekly_hours_of_another_day_leave_the_gym_closed(): void
    {
        $this->travelTo(Carbon::parse('2026-11-11 10:00', 'America/Puerto_Rico'));
        $this->authorize();
        ScheduleSlot::factory()->create(['weekday' => 4, 'start_time' => '06:00', 'end_time' => '22:00']);

        $this->assertRejected('check_in_gym_closed', 409);
    }

    public function test_special_hours_replace_that_days_regular_hours(): void
    {
        $this->travelTo(Carbon::parse('2026-11-11 10:00', 'America/Puerto_Rico'));
        $this->authorize();
        ScheduleSlot::factory()->create(['weekday' => 3, 'start_time' => '06:00', 'end_time' => '22:00']);
        $this->slot('special_hours', now()->setTime(14, 0), now()->setTime(18, 0));

        $this->assertRejected('check_in_gym_closed', 409);

        $this->travelTo(Carbon::parse('2026-11-11 15:00', 'America/Puerto_Rico'));
        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated();
    }

    public function test_special_hours_on_another_day_keep_todays_regular_hours(): void
    {
        $this->travelTo(Carbon::parse('2026-11-11 10:00', 'America/Puerto_Rico'));
        $this->authorize();
        ScheduleSlot::factory()->create(['weekday' => 3, 'start_time' => '06:00', 'end_time' => '22:00']);
        $this->slot('special_hours', now()->addDay()->setTime(14, 0), now()->addDay()->setTime(18, 0));

        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated();
    }

    public function test_athletes_only_rejects_paid_and_manual_members_with_the_period(): void
    {
        $this->open();
        $startsAt = now()->subMinutes(5)->startOfSecond();
        $endsAt = now()->addHours(2)->startOfSecond();
        $this->slot('athletes_only', $startsAt, $endsAt);

        foreach (['paid', 'manual'] as $type) {
            Authorization::query()->delete();
            $this->authorize($type);
            $this->postJson('/api/user/check-in', self::INSIDE)->assertStatus(409)
                ->assertJsonPath('error.code', 'check_in_athletes_only')
                ->assertJsonPath('error.details', ['starts_at' => $startsAt->toISOString(), 'ends_at' => $endsAt->toISOString()]);
        }
        $this->assertDatabaseCount('facility_sessions', 0);
    }

    public function test_an_athletes_only_period_outside_regular_hours_opens_the_gym_for_athletes(): void
    {
        $this->authorize('athlete');
        $this->slot('athletes_only', now()->subMinutes(5), now()->addHours(2));

        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated()->assertJsonPath('athletes_period.state', 'active');
    }

    public function test_location_required(): void
    {
        $this->authorize();
        $this->open();
        $this->assertRejected('location_required', 422, []);
        $this->assertRejected('location_required', 422, ['latitude' => self::INSIDE['latitude'], 'longitude' => self::INSIDE['longitude']]);
    }

    public function test_low_accuracy(): void
    {
        $this->authorize();
        $this->open();
        $this->assertRejected('check_in_low_accuracy', 422, [...self::INSIDE, 'accuracy' => 31]);
    }

    public function test_outside_the_boundary(): void
    {
        $this->authorize();
        $this->open();
        // About 111 m north of the center.
        $this->assertRejected('check_in_outside_boundary', 403, [...self::INSIDE, 'latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER + 0.001]);
    }

    public function test_the_boundary_comes_from_the_configuration(): void
    {
        config(['check_in.center_latitude' => 18.0, 'check_in.center_longitude' => -66.0]);
        $this->authorize();
        $this->open();

        $this->assertRejected('check_in_outside_boundary', 403);
        $this->postJson('/api/user/check-in', ['latitude' => 18.0001, 'longitude' => -66.0, 'accuracy' => 5])->assertCreated();
    }

    public function test_out_of_range_numbers_are_a_validation_error(): void
    {
        foreach ([['latitude' => 91], ['longitude' => -181], ['accuracy' => -1], ['latitude' => 'here']] as $bad) {
            $this->postJson('/api/user/check-in', [...self::INSIDE, ...$bad])->assertUnprocessable()
                ->assertJsonPath('error.code', 'validation_failed');
        }
    }

    public function test_injection_text_in_the_location_fields_is_a_validation_error(): void
    {
        $this->authorize();
        $this->open();
        // Six requests plus the final one stay under the throttle of 10 a minute.
        $payloads = ["1'; DROP TABLE facility_sessions; --", '<script>alert(1)</script>'];
        foreach (['latitude', 'longitude', 'accuracy'] as $field) {
            foreach ($payloads as $payload) {
                $response = $this->postJson('/api/user/check-in', [...self::INSIDE, $field => $payload]);

                $response->assertUnprocessable()->assertJsonPath('error.code', 'validation_failed')
                    ->assertJsonPath("error.details.$field.0", 'numeric');
                $this->assertStringNotContainsString('script', $response->getContent());
                $this->assertDatabaseCount('facility_sessions', 0);
            }
        }
        // The table is still there and a clean request still works.
        $this->postJson('/api/user/check-in', self::INSIDE)->assertCreated();
    }

    public function test_a_staff_session_is_refused_on_get_and_post(): void
    {
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->authorize();
        $this->open();
        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa();

        $this->getJson('/api/user/check-in')->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
        $this->postJson('/api/user/check-in', self::INSIDE)->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
        $this->assertDatabaseCount('facility_sessions', 0);
    }

    public function test_checks_run_in_the_decided_order(): void
    {
        // Nothing set up: authorization fails before gym closed and location.
        $this->assertRejected('check_in_no_authorization', 403, []);

        $this->authorize('paid', ['photo_path' => null, 'photo_pending_at' => now()]);
        $this->assertRejected('check_in_photo_required', 409, []);

        Authorization::query()->update(['photo_path' => 'photos/x.jpg']);
        $this->assertRejected('check_in_photo_pending', 409, []);

        Authorization::query()->update(['photo_pending_at' => null]);
        $this->assertRejected('check_in_gym_closed', 409, []);

        $this->slot('athletes_only', now()->subMinutes(5), now()->addHour());
        $this->assertRejected('check_in_athletes_only', 409, []);

        Authorization::query()->delete();
        $this->authorize('athlete');
        $this->assertRejected('location_required', 422, []);
        $this->assertRejected('check_in_low_accuracy', 422, [...self::INSIDE, 'latitude' => 0, 'accuracy' => 500]);
    }

    public function test_an_athletes_only_period_never_ends_an_active_session(): void
    {
        $this->authorize();
        $session = FacilitySession::factory()->paid()->startedMinutesAgo(30)->create(['user_id' => $this->user->id]);
        $this->slot('athletes_only', now()->subMinutes(5), now()->addHours(3));

        $this->postJson('/api/user/check-in')->assertOk()->assertJsonPath('session.id', $session->id)
            ->assertJsonPath('athletes_period.state', 'active');
        $this->assertSame('active', $session->fresh()->status);
    }

    public function test_an_athletes_only_period_starting_inside_the_session_is_upcoming(): void
    {
        $this->authorize();
        FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $this->user->id]);
        $startsAt = now()->addMinutes(80)->startOfSecond();
        $this->slot('athletes_only', $startsAt, now()->addHours(4));

        $this->getJson('/api/user/check-in')->assertOk()
            ->assertJsonPath('athletes_period.state', 'upcoming')
            ->assertJsonPath('athletes_period.starts_at', $startsAt->toISOString());
    }

    public function test_an_athletes_only_period_within_the_notice_minutes_is_upcoming_without_a_session(): void
    {
        config(['check_in.notice_minutes' => 60]);
        $this->authorize();
        $startsAt = now()->addMinutes(50)->startOfSecond();
        $this->slot('athletes_only', $startsAt, now()->addHours(3));

        $this->getJson('/api/user/check-in')->assertOk()
            ->assertJsonPath('athletes_period.state', 'upcoming')
            ->assertJsonPath('athletes_period.starts_at', $startsAt->toISOString());
    }

    public function test_an_athletes_only_period_beyond_the_notice_minutes_is_not_shown_without_a_session(): void
    {
        config(['check_in.notice_minutes' => 60]);
        $this->authorize('athlete');
        $this->slot('athletes_only', now()->addMinutes(70), now()->addHours(3));

        $this->getJson('/api/user/check-in')->assertOk()->assertJsonPath('athletes_period', null);
    }

    public function test_an_athletes_only_period_after_the_session_ends_is_not_shown(): void
    {
        $this->authorize();
        FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $this->user->id]);
        $this->slot('athletes_only', now()->addHours(2), now()->addHours(4));

        $this->getJson('/api/user/check-in')->assertOk()->assertJsonPath('athletes_period', null);
    }

    public function test_the_location_is_never_stored(): void
    {
        $this->authorize();
        $this->open();
        $body = ['latitude' => 18.2109876, 'longitude' => -67.1409876, 'accuracy' => 12.3456];
        config(['check_in.center_latitude' => 18.2109, 'check_in.center_longitude' => -67.1409]);

        $this->postJson('/api/user/check-in', $body)->assertCreated();
        $this->postJson('/api/user/check-in', [...$body, 'latitude' => 18.3109876])->assertOk();

        $stored = json_encode([DB::table('facility_sessions')->get(), DB::table('audit_log_entries')->get(), DB::table('sign_in_sessions')->get()]);
        foreach (['18.2109876', '18.3109876', '67.1409876', '12.3456'] as $value) {
            $this->assertStringNotContainsString($value, $stored);
        }
        $columns = DB::getSchemaBuilder()->getColumnListing('facility_sessions');
        $this->assertEmpty(array_filter($columns, fn ($c) => preg_match('/lat|lng|long|accuracy|location/', $c)));
    }

    public function test_check_in_is_throttled_per_user(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/user/check-in', self::INSIDE)->assertForbidden();
        }
        $this->postJson('/api/user/check-in', self::INSIDE)->assertStatus(429)->assertJsonPath('error.code', 'too_many_requests');
    }

    public function test_check_in_needs_a_signed_in_user(): void
    {
        $this->app['auth']->forgetGuards();
        $this->flushSession();

        $this->getJson('/api/user/check-in')->assertUnauthorized();
        $this->postJson('/api/user/check-in', self::INSIDE)->assertUnauthorized();
    }
}
