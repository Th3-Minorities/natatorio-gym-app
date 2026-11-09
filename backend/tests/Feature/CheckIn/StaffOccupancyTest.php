<?php

namespace Tests\Feature\CheckIn;

use App\Models\FacilitySession;
use App\Models\ScheduleSlot;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/**
 * S-01 shows the same occupancy as C-01 on the User side (REQ-F-41, #26): the staff route answers with the
 * same count, top and time as /api/user/occupancy.
 */
class StaffOccupancyTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    public function test_sign_in_is_required(): void
    {
        $this->fromThePwa()->getJson('/api/staff/occupancy')->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
    }

    public function test_a_user_sign_in_does_not_grant_staff_access(): void
    {
        $user = User::factory()->create(['current_session_id' => 'device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa()
            ->getJson('/api/staff/occupancy')->assertUnauthorized();
    }

    /** @return array<string, array{string}> */
    public static function roles(): array
    {
        return ['Staff' => ['staff'], 'Administrator' => ['admin']];
    }

    #[DataProvider('roles')]
    public function test_staff_and_administrators_see_the_same_answer_as_users(string $role): void
    {
        config(['check_in.occupancy_max' => 60]);
        $this->travelTo(now()->startOfSecond());
        FacilitySession::factory()->startedMinutesAgo(30)->create();
        FacilitySession::factory()->startedMinutesAgo(10)->create();
        FacilitySession::factory()->startedMinutesAgo(40)->checkedOut(40)->create();

        $user = User::factory()->create(['current_session_id' => 'device']);
        $forUser = $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa()
            ->getJson('/api/user/occupancy')->assertOk()->json();

        $this->flushSession();
        $this->actingAs(StaffAccount::factory()->create(['role' => $role]), 'staff')->fromThePwa()
            ->getJson('/api/staff/occupancy')->assertOk()
            ->assertExactJson(['count' => 2, 'max' => 60, 'updated_at' => now()->toISOString(), 'gym' => 'closed'])
            ->assertExactJson($forUser);
    }

    /**
     * The "Gimnasio abierto" chip on S-01 (Figma 121:2841) follows the same schedule as Check In: a closure or no
     * open slot is closed, and an athletes-only period is open for athletes only.
     *
     * @return array<string, array{list<array<string, mixed>>, string}>
     */
    public static function schedules(): array
    {
        // Wednesday 2026-11-11, 10:00 in Puerto Rico.
        $regular = ['type' => 'regular_hours', 'weekday' => 3, 'start_time' => '06:00', 'end_time' => '22:00'];
        $athletes = [...$regular, 'type' => 'athletes_only', 'start_time' => '09:00', 'end_time' => '11:00'];
        $closure = [
            'type' => 'closure', 'weekday' => null, 'start_time' => null, 'end_time' => null,
            'starts_at' => '2026-11-11 08:00', 'ends_at' => '2026-11-11 12:00', 'text_es' => 'Cerrado.',
        ];

        return [
            'regular hours' => [[$regular], 'open'],
            'no slot now' => [[[...$regular, 'start_time' => '15:00']], 'closed'],
            'nothing scheduled' => [[], 'closed'],
            'a closure inside regular hours' => [[$regular, $closure], 'closed'],
            'an athletes-only period' => [[$regular, $athletes], 'athletes_only'],
            'an athletes-only period outside regular hours' => [[$athletes], 'athletes_only'],
        ];
    }

    /** @param list<array<string, mixed>> $slots */
    #[DataProvider('schedules')]
    public function test_the_answer_says_whether_the_gym_is_open_by_the_check_in_schedule(array $slots, string $gym): void
    {
        $this->travelTo('2026-11-11 10:00:00');
        foreach ($slots as $slot) {
            ScheduleSlot::factory()->create($slot);
        }

        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->getJson('/api/staff/occupancy')->assertOk()->assertJsonPath('gym', $gym);
    }

    public function test_a_deactivated_account_is_refused(): void
    {
        $this->actingAs(StaffAccount::factory()->create(['deactivated_at' => now()]), 'staff')->fromThePwa()
            ->getJson('/api/staff/occupancy')->assertUnauthorized();
    }
}
