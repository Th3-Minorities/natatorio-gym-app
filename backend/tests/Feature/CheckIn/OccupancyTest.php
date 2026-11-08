<?php

namespace Tests\Feature\CheckIn;

use App\Models\FacilitySession;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class OccupancyTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private function signIn(): void
    {
        $user = User::factory()->create(['current_session_id' => 'device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa();
    }

    public function test_sign_in_is_required(): void
    {
        $this->fromThePwa()->getJson('/api/user/occupancy')->assertUnauthorized()->assertJsonPath('error.code', 'unauthenticated');
    }

    public function test_staff_sign_in_does_not_grant_user_access(): void
    {
        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->getJson('/api/user/occupancy')->assertUnauthorized();
    }

    public function test_counts_only_non_void_ranges_containing_now_with_an_exclusive_end(): void
    {
        $this->signIn();
        $this->travelTo(now()->startOfSecond());
        FacilitySession::factory()->startedMinutesAgo(30)->create();
        FacilitySession::factory()->create(['started_at' => now(), 'ends_at' => now()->addHours(2)]);
        FacilitySession::factory()->startedMinutesAgo(120)->create();
        FacilitySession::factory()->create(['started_at' => now()->addMinute(), 'ends_at' => now()->addMinute()->addHours(2)]);
        FacilitySession::factory()->startedMinutesAgo(40)->checkedOut(40)->create();
        FacilitySession::factory()->startedMinutesAgo(50)->endedEarly(20)->create();
        FacilitySession::factory()->startedMinutesAgo(10)->create(['status' => 'void', 'ended_at' => now()->addMinute()]);

        $this->getJson('/api/user/occupancy')->assertOk()
            ->assertExactJson(['count' => 2, 'max' => 40, 'updated_at' => now()->toISOString()]);
    }

    public function test_empty_gym_has_zero_occupancy(): void
    {
        $this->signIn();
        $this->getJson('/api/user/occupancy')->assertOk()->assertJsonPath('count', 0)->assertJsonPath('max', 40);
    }

    public function test_returns_the_configured_occupancy_maximum(): void
    {
        config(['check_in.occupancy_max' => 60]);
        $this->signIn();
        $this->getJson('/api/user/occupancy')->assertOk()->assertJsonPath('max', 60);
    }
}
