<?php

namespace Tests\Feature\CheckIn;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\ScheduleSlot;
use App\Models\StaffAccount;
use App\Models\User;
use App\Support\GymBoundary;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\Concerns\InsertsAtTheSameTime;
use Tests\TestCase;

class CheckOutConcurrencyTest extends TestCase
{
    use CallsTheApiFromThePwa, DatabaseTruncation, InsertsAtTheSameTime;

    protected function tearDown(): void
    {
        $this->emptyEveryTable();

        parent::tearDown();
    }

    public function test_two_real_check_out_requests_have_one_winner(): void
    {
        $session = FacilitySession::factory()->startedMinutesAgo(10)->create();
        $first = StaffAccount::factory()->create();
        $second = StaffAccount::factory()->create();
        $process = proc_open(
            [PHP_BINARY, base_path('tests/Support/check-out-holder.php')],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
        );
        fwrite($pipes[0], json_encode([
            'connection' => config('database.connections.'.config('database.default')),
            'session_id' => $session->id, 'staff_id' => $first->id,
        ], JSON_THROW_ON_ERROR));
        fclose($pipes[0]);

        try {
            $this->assertSame('locked', trim(fgets($pipes[1])));
            $response = $this->actingAs($second, 'staff')->fromThePwa()
                ->postJson("/api/staff/sessions/{$session->id}/check-out");
            $output = trim(stream_get_contents($pipes[1]));
            $this->assertSame(409, $response->getStatusCode(), "Holder said: {$output}");
            $response->assertJsonPath('error.code', 'check_out_session_not_active');
            $result = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
            $this->assertTrue($result['blocked'], 'The second request never waited for the row lock.');
            $this->assertSame(200, $result['status']);
            $this->assertSame('checked_out', $result['body']['session']['end_reason']);
            $this->assertSame($first->id, $session->fresh()->checked_out_by_staff_account_id);
            $this->assertSame($result['body']['session']['ended_at'], $session->fresh()->ended_at->toISOString());
            $this->assertDatabaseCount('audit_log_entries', 0);
        } finally {
            $errors = trim(stream_get_contents($pipes[2]));
            fclose($pipes[1]);
            fclose($pipes[2]);
            $exit = proc_close($process);
        }

        $this->assertSame(0, $exit, $errors);
    }

    public function test_reentry_after_check_out_is_a_second_visit_on_the_same_day(): void
    {
        // Real commits matter here: PostgreSQL now() stays fixed inside a test's wrapping transaction.
        $user = User::factory()->create(['current_session_id' => 'current-device']);
        $term = AcademicTerm::factory()->create(['starts_on' => today()->subMonth(), 'ends_on' => today()->addMonth()]);
        $authorization = Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        ScheduleSlot::factory()->create([
            'type' => 'regular_hours', 'weekday' => null, 'start_time' => null, 'end_time' => null,
            'starts_at' => now()->subHour(), 'ends_at' => now()->addHours(4),
        ]);
        $first = FacilitySession::factory()->startedMinutesAgo(30)->create([
            'user_id' => $user->id, 'authorization_id' => $authorization->id,
        ]);
        $this->actingAs(StaffAccount::factory()->create(), 'staff')->fromThePwa()
            ->postJson("/api/staff/sessions/{$first->id}/check-out")->assertOk();
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'current-device']);

        $response = $this->postJson('/api/user/check-in', [
            'latitude' => GymBoundary::GYM_LATITUDE_PLACEHOLDER,
            'longitude' => GymBoundary::GYM_LONGITUDE_PLACEHOLDER, 'accuracy' => 5,
        ])->assertCreated()->assertJsonPath('session.status', 'active')
            ->assertJsonPath('session.end_reason', null)->assertJsonPath('session.ended_at', null);

        $this->assertNotSame($first->id, $response->json('session.id'));
        $this->assertSame(2, FacilitySession::query()->where('user_id', $user->id)
            ->whereDate('started_at', today())->where('status', '<>', 'void')->count());
        $this->assertSame('checked_out', $first->fresh()->status);
        $this->assertArrayNotHasKey('countdown', $response->json('session'));
        $this->assertArrayNotHasKey('term', $response->json('session'));
    }
}
