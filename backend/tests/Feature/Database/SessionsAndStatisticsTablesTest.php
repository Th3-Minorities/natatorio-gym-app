<?php

namespace Tests\Feature\Database;

use App\Models\Authorization;
use App\Models\DailyVisitTotal;
use App\Models\FacilitySession;
use App\Models\ManualVisitCount;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\AssertsDatabaseRules;
use Tests\TestCase;

/** Rules for facility_sessions, manual_visit_counts and daily_visit_totals (data-model.md sections 3, 5 and 6). */
class SessionsAndStatisticsTablesTest extends TestCase
{
    use AssertsDatabaseRules, RefreshDatabase;

    public function test_a_check_in_sends_no_time_and_the_database_sets_both(): void
    {
        $user = User::factory()->create();

        DB::table('facility_sessions')->insert(['user_id' => $user->id, 'authorization_type' => 'manual', 'status' => 'active']);

        $row = DB::selectOne("select started_at, ends_at, ends_at = started_at + interval '2 hours' as two_hours, abs(extract(epoch from started_at - now())) < 1 as set_by_database from facility_sessions");
        $this->assertTrue($row->two_hours);
        $this->assertTrue($row->set_by_database);
    }

    public function test_a_session_ends_exactly_two_hours_after_it_starts(): void
    {
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['ends_at' => now()->addHours(3)]));
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['ends_at' => now()->addHour()]));
    }

    public function test_a_session_cannot_end_before_it_starts(): void
    {
        $this->assertRejected('23514', fn () => FacilitySession::factory()->checkedOut(minutesIn: -5)->create());
    }

    public function test_ending_early_is_only_allowed_within_the_two_hours(): void
    {
        FacilitySession::factory()->endedEarly(minutesIn: 30)->create();

        $this->assertRejected('23514', fn () => FacilitySession::factory()->endedEarly(minutesIn: 130)->create());
    }

    public function test_a_check_out_may_come_after_the_two_hours(): void
    {
        FacilitySession::factory()->checkedOut(minutesIn: 180)->create();

        $this->assertSame(1, FacilitySession::query()->count());
    }

    public function test_the_status_is_one_of_the_six_values(): void
    {
        foreach (['active', 'expired'] as $status) {
            FacilitySession::factory()->state(['status' => $status])->create(['user_id' => User::factory()->create()->id]);
        }
        foreach (['checked_out', 'ended_early', 'closed', 'void'] as $status) {
            FacilitySession::factory()->checkedOut()->state(['status' => $status])->create(['user_id' => User::factory()->create()->id]);
        }

        $this->assertRejected('23514', fn () => FacilitySession::factory()->state(['status' => 'finished'])->create());
        $this->assertSame(6, FacilitySession::query()->count());
    }

    public function test_only_ended_statuses_have_an_ended_at(): void
    {
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['ended_at' => now()]));
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['status' => 'expired', 'ended_at' => now()]));
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['status' => 'checked_out', 'ended_at' => null]));
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['status' => 'closed', 'ended_at' => null]));
    }

    public function test_the_authorization_type_is_paid_athlete_or_manual(): void
    {
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['authorization_type' => 'guest']));
    }

    public function test_only_a_paid_session_has_a_member_group(): void
    {
        FacilitySession::factory()->paid('student')->create();
        FacilitySession::factory()->paid('employee')->create();
        FacilitySession::factory()->create(['authorization_type' => 'athlete']);

        $this->assertRejected('23514', fn () => FacilitySession::factory()->paid('faculty')->create());
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['authorization_type' => 'paid', 'member_group' => null]));
        $this->assertRejected('23514', fn () => FacilitySession::factory()->create(['authorization_type' => 'athlete', 'member_group' => 'student']));
    }

    public function test_a_manual_entry_from_the_paper_log_is_a_checked_out_session(): void
    {
        FacilitySession::factory()->checkedOut(minutesIn: 45)->state(['entered_by_staff_account_id' => StaffAccount::factory()])->create();

        $this->assertRejected('23514', fn () => FacilitySession::factory()->state(['entered_by_staff_account_id' => StaffAccount::factory()])->create());
        $this->assertRejected('23514', fn () => FacilitySession::factory()->endedEarly()->state(['entered_by_staff_account_id' => StaffAccount::factory()])->create());
    }

    public function test_one_active_session_per_user(): void
    {
        $user = User::factory()->create();
        FacilitySession::factory()->create(['user_id' => $user->id]);

        $this->assertRejected('23P01', fn () => FacilitySession::factory()->create(['user_id' => $user->id]));
    }

    public function test_two_users_may_be_inside_at_the_same_time(): void
    {
        FacilitySession::factory()->count(2)->create();

        $this->assertSame(2, FacilitySession::query()->count());
    }

    public function test_an_expired_session_no_longer_blocks_a_new_check_in(): void
    {
        $user = User::factory()->create();
        FacilitySession::factory()->startedMinutesAgo(180)->create(['user_id' => $user->id, 'status' => 'expired']);
        FacilitySession::factory()->create(['user_id' => $user->id]);

        $this->assertSame(2, FacilitySession::query()->count());
    }

    public function test_a_session_not_yet_expired_by_the_task_still_blocks_until_ends_at(): void
    {
        $user = User::factory()->create();
        FacilitySession::factory()->startedMinutesAgo(90)->create(['user_id' => $user->id]);

        $this->assertRejected('23P01', fn () => FacilitySession::factory()->create(['user_id' => $user->id]));
    }

    public function test_a_check_out_frees_the_user_at_once(): void
    {
        $user = User::factory()->create();
        FacilitySession::factory()->startedMinutesAgo(30)->checkedOut(minutesIn: 20)->create(['user_id' => $user->id]);
        FacilitySession::factory()->create(['user_id' => $user->id]);

        $this->assertSame(2, FacilitySession::query()->count());
    }

    public function test_a_late_check_out_does_not_block_a_check_in_made_in_the_meantime(): void
    {
        $user = User::factory()->create();
        FacilitySession::factory()->startedMinutesAgo(240)->checkedOut(minutesIn: 200)->create(['user_id' => $user->id]);
        FacilitySession::factory()->startedMinutesAgo(100)->create(['user_id' => $user->id]);

        $this->assertSame(2, FacilitySession::query()->count());
    }

    public function test_a_void_session_does_not_block(): void
    {
        $user = User::factory()->create();
        FacilitySession::factory()->startedMinutesAgo(10)->checkedOut(minutesIn: 120)->state(['status' => 'void'])->create(['user_id' => $user->id]);
        FacilitySession::factory()->create(['user_id' => $user->id]);

        $this->assertSame(2, FacilitySession::query()->count());
    }

    public function test_a_user_with_sessions_cannot_be_deleted(): void
    {
        $session = FacilitySession::factory()->create();

        $this->assertRejected('23503', fn () => DB::table('users')->where('id', $session->user_id)->delete());
    }

    public function test_deleting_an_authorization_keeps_the_session_and_its_type(): void
    {
        $authorization = Authorization::factory()->paid()->create();
        $session = FacilitySession::factory()->paid('student')->create(['user_id' => $authorization->user_id, 'authorization_id' => $authorization->id]);

        DB::table('authorizations')->where('id', $authorization->id)->delete();

        $session = $session->fresh();
        $this->assertNull($session->authorization_id);
        $this->assertSame('paid', $session->authorization_type);
    }

    public function test_a_staff_account_named_on_a_session_cannot_be_deleted(): void
    {
        $staff = StaffAccount::factory()->create();
        FacilitySession::factory()->checkedOut()->create(['checked_out_by_staff_account_id' => $staff->id]);
        $enteredBy = StaffAccount::factory()->create();
        FacilitySession::factory()->checkedOut()->create(['entered_by_staff_account_id' => $enteredBy->id]);

        $this->assertRejected('23503', fn () => DB::table('staff_accounts')->where('id', $staff->id)->delete());
        $this->assertRejected('23503', fn () => DB::table('staff_accounts')->where('id', $enteredBy->id)->delete());
    }

    public function test_a_manual_visit_count_keeps_a_number_for_a_time_block_and_no_names(): void
    {
        $count = ManualVisitCount::factory()->create(['visits' => 12]);

        $this->assertSame(12, $count->fresh()->visits);
        $this->assertSame(
            ['id', 'starts_at', 'ends_at', 'visits', 'entered_by_staff_account_id', 'created_at', 'updated_at'],
            Schema::getColumnListing('manual_visit_counts'),
        );
    }

    public function test_a_manual_visit_count_needs_a_number_and_its_staff_account(): void
    {
        $this->assertRejected('23502', fn () => ManualVisitCount::factory()->create(['visits' => null]));
        $this->assertRejected('23503', fn () => ManualVisitCount::factory()->create(['entered_by_staff_account_id' => 999_999]));
    }

    public function test_a_staff_account_that_entered_counts_cannot_be_deleted(): void
    {
        $count = ManualVisitCount::factory()->create();

        $this->assertRejected('23503', fn () => DB::table('staff_accounts')->where('id', $count->entered_by_staff_account_id)->delete());
    }

    public function test_there_is_one_daily_total_per_day_and_it_keeps_its_json(): void
    {
        $total = DailyVisitTotal::factory()->create(['day' => '2026-11-04', 'totals' => ['visits' => 40, 'busiest_hour' => 17]]);

        $this->assertSame(['visits' => 40, 'busiest_hour' => 17], $total->fresh()->totals);
        $this->assertRejected('23505', fn () => DailyVisitTotal::factory()->create(['day' => '2026-11-04']));
    }

    public function test_a_daily_total_needs_its_totals(): void
    {
        $this->assertRejected('23502', fn () => DailyVisitTotal::factory()->create(['totals' => null]));
    }
}
