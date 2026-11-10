<?php

namespace Tests\Feature\CheckIn;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\ScheduleSlot;
use App\Models\User;
use App\Support\GymBoundary;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\Concerns\InsertsAtTheSameTime;
use Tests\TestCase;

/**
 * Two Check Ins of one User at the same moment (REQ-F-36, REQ-NF-42). Another process inserts a session
 * and keeps its transaction open, so this request's read finds nothing and its insert must wait. When the
 * other one commits, the exclusion constraint makes this insert fail, and the request answers 200 with the
 * session that won, as for an active session (check-in-flows diagram 3). No wrapping transaction here
 * (DatabaseTruncation), because the other process only sees committed rows.
 */
class CheckInConcurrencyTest extends TestCase
{
    use CallsTheApiFromThePwa, DatabaseTruncation, InsertsAtTheSameTime;

    protected function tearDown(): void
    {
        $this->emptyEveryTable();

        parent::tearDown();
    }

    public function test_a_simultaneous_check_in_returns_the_session_that_won(): void
    {
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $term = AcademicTerm::factory()->create(['starts_on' => today()->subMonth(), 'ends_on' => today()->addMonth()]);
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        ScheduleSlot::factory()->create([
            'type' => 'regular_hours', 'weekday' => null, 'start_time' => null, 'end_time' => null,
            'starts_at' => now()->subHour(), 'ends_at' => now()->addHours(4),
        ]);

        $process = proc_open(
            [PHP_BINARY, base_path('tests/Support/session-holder.php')],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
        );
        fwrite($pipes[0], json_encode([
            'connection' => config('database.connections.'.config('database.default')),
            'row' => ['user_id' => $user->id, 'authorization_type' => 'manual', 'member_group' => 'student', 'status' => 'active'],
        ], JSON_THROW_ON_ERROR));
        fclose($pipes[0]);
        $this->assertSame('inserted', trim(fgets($pipes[1])));

        $response = $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device'])->fromThePwa()
            ->postJson('/api/user/check-in', [
                'latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER, 'longitude' => GymBoundary::GYM_LONGITUDE_PLACEHOLDER, 'accuracy' => 5,
            ]);

        $holder = trim(stream_get_contents($pipes[1]));
        $errors = trim(stream_get_contents($pipes[2]));
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);

        $this->assertSame('blocked', $holder, "The Check In never waited for the other session. {$errors}");
        $winner = DB::table('facility_sessions')->sole();
        $response->assertOk()->assertJsonPath('session.id', $winner->id);
    }
}
