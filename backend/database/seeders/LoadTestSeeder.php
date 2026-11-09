<?php

namespace Database\Seeders;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\ImportedMembership;
use App\Models\ScheduleSlot;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Database\Seeder;

/**
 * Users who can all Check In, for the k6 load test (issue #83, tests/load/). Run it after the FakeDataSeeder:
 * php artisan db:seed --class=LoadTestSeeder. The accounts are load-0001@example.com to load-0100@example.com,
 * password "password", the same list as tests/load/users.csv. Never runs in production.
 */
class LoadTestSeeder extends Seeder
{
    public const USERS = 100;

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Load test users are never seeded in production.');

            return;
        }

        $term = AcademicTerm::query()->whereDate('starts_on', '<=', today())->whereDate('ends_on', '>=', today())->firstOrFail();

        // Open all day, so the run does not depend on the weekly hours. An athletes-only period still keeps members out.
        ScheduleSlot::factory()->create([
            'type' => 'special_hours', 'weekday' => null, 'start_time' => null, 'end_time' => null,
            'starts_at' => today(), 'ends_at' => today()->addDay(), 'text_es' => 'Horario de prueba de carga.',
        ]);

        foreach (range(1, self::USERS) as $n) {
            $user = User::factory()->create(['email' => sprintf('load-%04d@example.com', $n)]);
            WaiverAcceptance::factory()->create(['user_id' => $user->id]);
            Authorization::factory()->paid(ImportedMembership::factory()->create(['academic_term_id' => $term->id]))
                ->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        }
    }
}
