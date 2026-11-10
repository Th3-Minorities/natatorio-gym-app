<?php

namespace Tests\Feature\Auth;

use App\Models\AcademicTerm;
use App\Models\EmailLink;
use App\Models\ImportedMembership;
use App\Models\RosterRecord;
use Illuminate\Cache\DatabaseStore;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Concerns\InsertsAtTheSameTime;
use Tests\TestCase;

class PaidRegistrationConcurrencyTest extends TestCase
{
    use DatabaseTruncation, InsertsAtTheSameTime;

    protected function tearDown(): void
    {
        $this->emptyEveryTable();
        parent::tearDown();
    }

    public function test_parallel_lookups_from_one_ip_reserve_the_limit_before_querying_the_store(): void
    {
        $limit = 2;
        $requests = $limit + 3;
        $input = json_encode([
            'connection' => config('database.connections.'.config('database.default')),
            'prefix' => 'registration-test-'.Str::uuid().':', 'limit' => $limit,
        ], JSON_THROW_ON_ERROR)."\n";
        $children = [];
        try {
            for ($i = 0; $i < $requests; $i++) {
                $process = proc_open([PHP_BINARY, base_path('tests/Support/registration-lookup.php')],
                    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                $this->assertIsResource($process);
                $children[] = [$process, $pipes];
                stream_set_timeout($pipes[1], 20);
                fwrite($pipes[0], $input);
            }
            foreach ($children as [, $pipes]) {
                $this->assertSame(DatabaseStore::class."\n", fgets($pipes[1]));
                $this->assertSame("ready\n", fgets($pipes[1]));
            }
            foreach ($children as [, $pipes]) {
                fwrite($pipes[0], "start\n");
            }
            $statuses = [];
            $pending = [];
            foreach ($children as [$process, $pipes]) {
                $result = trim((string) fgets($pipes[1]));
                if ($result === 'lookup') {
                    $pending[] = $pipes;
                } else {
                    $this->assertSame('429', $result);
                    $statuses[] = $result;
                }
            }
            foreach ($pending as $pipes) {
                fwrite($pipes[0], "finish\n");
                $statuses[] = trim((string) fgets($pipes[1]));
            }
            foreach ($children as [$process, $pipes]) {
                fclose($pipes[0]);
                $errors = stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $this->assertSame(0, proc_close($process), $errors);
            }
            $children = [];
            $counts = array_count_values($statuses);
            $this->assertCount($requests, $statuses);
            $this->assertLessThanOrEqual($limit, $counts['422'] ?? 0);
            $this->assertSame($requests - ($counts['422'] ?? 0), $counts['429'] ?? 0);
            $this->assertSame($limit, $counts['422'] ?? 0);
        } finally {
            foreach ($children as [$process]) {
                if (is_resource($process)) {
                    proc_terminate($process);
                    proc_close($process);
                }
            }
        }
    }

    public function test_two_simultaneous_claims_create_exactly_one_account_and_keep_only_its_photo(): void
    {
        Storage::fake('local');
        $term = AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);
        ImportedMembership::factory()->create(['academic_term_id' => $term->id, 'authorization_number' => 'A']);
        $this->assertTwoSimultaneousClaimsCreateOneAccount('paid');
    }

    public function test_two_simultaneous_athlete_link_claims_create_exactly_one_account_and_keep_only_its_photo(): void
    {
        Storage::fake('local');
        AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);
        $record = RosterRecord::factory()->create();
        EmailLink::factory()->create(['roster_record_id' => $record->id, 'token_hash' => hash('sha256', 'tok')]);
        $this->assertTwoSimultaneousClaimsCreateOneAccount('athlete');
    }

    private function assertTwoSimultaneousClaimsCreateOneAccount(string $mode): void
    {
        $input = json_encode([
            'mode' => $mode,
            'connection' => config('database.connections.'.config('database.default')),
            'root' => Storage::disk('local')->path(''),
        ], JSON_THROW_ON_ERROR)."\n";
        $children = [];
        try {
            for ($i = 0; $i < 2; $i++) {
                $process = proc_open([PHP_BINARY, base_path('tests/Support/registration-claim.php')],
                    [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
                $this->assertIsResource($process);
                stream_set_timeout($pipes[1], 20);
                fwrite($pipes[0], $input);
                $children[] = [$process, $pipes];
            }
            foreach ($children as [, $pipes]) {
                $this->assertSame("photo-saved\n", fgets($pipes[1]), 'Each request must reach the photo barrier before either claims.');
            }
            foreach ($children as [, $pipes]) {
                fwrite($pipes[0], "claim\n");
                fclose($pipes[0]);
            }
            $statuses = [];
            foreach ($children as [$process, $pipes]) {
                $statuses[] = trim(stream_get_contents($pipes[1]));
                $errors = stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                $this->assertSame(0, proc_close($process), $errors);
            }
            $children = [];
            sort($statuses);
            $this->assertSame(['201', '422'], $statuses);
            $this->assertDatabaseCount('users', 1);
            $this->assertDatabaseCount('authorizations', 1);
            $this->assertDatabaseCount('waiver_acceptances', 1);
            $this->assertCount(1, Storage::disk('local')->allFiles('photos'));
        } finally {
            foreach ($children as [$process]) {
                if (is_resource($process)) {
                    proc_terminate($process);
                    proc_close($process);
                }
            }
        }
    }
}
