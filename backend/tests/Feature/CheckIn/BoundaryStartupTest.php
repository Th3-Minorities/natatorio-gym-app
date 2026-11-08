<?php

namespace Tests\Feature\CheckIn;

use App\Support\GymBoundary;
use RuntimeException;
use Tests\TestCase;

/** The app refuses to start with a boundary over 50 m from the gym, unless a flag allows it (REQ-NF-29, architecture D6). */
class BoundaryStartupTest extends TestCase
{
    public function test_the_default_boundary_is_at_the_gym(): void
    {
        GymBoundary::assertNearTheGym();
        $this->addToAssertionCount(1);
    }

    public function test_a_center_within_50_meters_starts_when_center_plus_radius_fits(): void
    {
        // About 44 m north, with a radius that ends just inside 50 m.
        config(['check_in.center_latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER + 0.0004]);
        config(['check_in.radius_meters' => 50 - $this->centerDistance() - 0.01]);
        GymBoundary::assertNearTheGym();
        $this->addToAssertionCount(1);
    }

    public function test_center_plus_radius_just_over_50_meters_stops_the_app(): void
    {
        config(['check_in.center_latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER + 0.0004]);
        config(['check_in.radius_meters' => 50 - $this->centerDistance() + 0.01]);
        $this->expectException(RuntimeException::class);
        GymBoundary::assertNearTheGym();
    }

    public function test_a_center_44_meters_off_with_a_50_meter_radius_stops_the_app(): void
    {
        // The boundary would reach about 94 m from the gym.
        config(['check_in.center_latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER + 0.0004]);
        config(['check_in.radius_meters' => 50]);
        $this->expectException(RuntimeException::class);
        GymBoundary::assertNearTheGym();
    }

    public function test_a_center_farther_than_50_meters_stops_the_app(): void
    {
        // About 56 m north.
        config(['check_in.center_latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER + 0.0005, 'check_in.radius_meters' => 1]);
        $this->expectException(RuntimeException::class);
        GymBoundary::assertNearTheGym();
    }

    public function test_the_flag_allows_another_boundary_for_development_and_the_demo(): void
    {
        config(['check_in.center_latitude' => 0, 'check_in.allow_any_boundary' => true]);
        GymBoundary::assertNearTheGym();
        $this->addToAssertionCount(1);
    }

    public function test_production_ignores_the_flag(): void
    {
        $this->app['env'] = 'production';
        config(['check_in.center_latitude' => 0, 'check_in.allow_any_boundary' => true]);
        $this->expectException(RuntimeException::class);
        GymBoundary::assertNearTheGym();
    }

    public function test_production_refuses_a_radius_over_50_meters(): void
    {
        $this->app['env'] = 'production';
        config(['check_in.radius_meters' => 51]);
        $this->expectException(RuntimeException::class);
        GymBoundary::assertNearTheGym();
    }

    public function test_production_accepts_a_radius_of_50_meters(): void
    {
        $this->app['env'] = 'production';
        config(['check_in.radius_meters' => 50]);
        GymBoundary::assertNearTheGym();
        $this->addToAssertionCount(1);
    }

    public function test_production_refuses_a_center_off_the_gym_with_a_50_meter_radius(): void
    {
        $this->app['env'] = 'production';
        config(['check_in.center_latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER + 0.0004, 'check_in.radius_meters' => 50]);
        $this->expectException(RuntimeException::class);
        GymBoundary::assertNearTheGym();
    }

    public function test_the_demo_may_use_a_larger_radius(): void
    {
        config(['check_in.radius_meters' => 200, 'check_in.allow_any_boundary' => true]);
        GymBoundary::assertNearTheGym();
        $this->addToAssertionCount(1);
    }

    private function centerDistance(): float
    {
        return GymBoundary::distanceMeters(
            GymBoundary::GYM_LATITUDE_PLACEHOLDER, GymBoundary::GYM_LONGITUDE_PLACEHOLDER,
            config('check_in.center_latitude'), config('check_in.center_longitude'),
        );
    }
}
