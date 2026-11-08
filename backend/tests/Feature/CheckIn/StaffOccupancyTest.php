<?php

namespace Tests\Feature\CheckIn;

use App\Models\FacilitySession;
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
            ->assertExactJson(['count' => 2, 'max' => 60, 'updated_at' => now()->toISOString()])
            ->assertExactJson($forUser);
    }

    public function test_a_deactivated_account_is_refused(): void
    {
        $this->actingAs(StaffAccount::factory()->create(['deactivated_at' => now()]), 'staff')->fromThePwa()
            ->getJson('/api/staff/occupancy')->assertUnauthorized();
    }
}
