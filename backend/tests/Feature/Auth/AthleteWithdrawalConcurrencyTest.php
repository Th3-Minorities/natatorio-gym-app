<?php

namespace Tests\Feature\Auth;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\RosterRecord;
use App\Services\RegistrationPhoto;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\Concerns\InsertsAtTheSameTime;
use Tests\TestCase;

/** A withdrawal and the last registration step at the same moment: the removed athlete never keeps access (#163). */
class AthleteWithdrawalConcurrencyTest extends TestCase
{
    use CallsTheApiFromThePwa, DatabaseTruncation, InsertsAtTheSameTime;

    protected function tearDown(): void
    {
        $this->emptyEveryTable();

        parent::tearDown();
    }

    public function test_a_registration_that_finishes_during_a_withdrawal_waits_for_it_and_is_refused(): void
    {
        $this->fromThePwa();
        Cache::flush();
        Storage::fake('local');
        $this->mock(UncompromisedVerifier::class)->shouldReceive('verify')->andReturn(true);
        $this->mock(RegistrationPhoto::class)->shouldReceive('save')->andReturnUsing(function () {
            Storage::disk('local')->put('photos/athlete.jpg', 'converted JPEG');

            return 'photos/athlete.jpg';
        });
        config(['registration.waiver.version' => 'test-v1', 'registration.waiver.es' => 'Test waiver', 'registration.waiver.en' => 'Test waiver']);
        AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);
        $record = RosterRecord::factory()->create();
        EmailLink::factory()->create(['roster_record_id' => $record->id, 'token_hash' => hash('sha256', 'tok')]);
        $notice = $this->getJson('/api/user/registration/privacy')->assertOk();
        $this->postJson('/api/user/registration/privacy', ['version' => $notice->json('version')])->assertNoContent();

        $process = proc_open(
            [PHP_BINARY, base_path('tests/Support/roster-withdrawal-holder.php')],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
        );
        fwrite($pipes[0], json_encode([
            'connection' => config('database.connections.'.config('database.default')),
            'roster_record_id' => $record->id,
        ], JSON_THROW_ON_ERROR));
        fclose($pipes[0]);

        try {
            $this->assertSame('locked', trim(fgets($pipes[1])));
            $response = $this->post('/api/user/registration/athlete/complete', [
                'token' => 'tok', 'password' => 'a long password', 'password_confirmation' => 'a long password',
                'photo' => UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')),
                'waiver_accepted' => true, 'waiver_version' => 'test-v1',
                'emergency_contact_name' => 'Ana Rodríguez', 'emergency_contact_phone' => '787 555 0100', 'locale' => 'es',
            ], ['Accept' => 'application/json']);
            $output = trim(stream_get_contents($pipes[1]));
            $result = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
        } finally {
            $errors = trim(stream_get_contents($pipes[2]));
            fclose($pipes[1]);
            fclose($pipes[2]);
            $exit = proc_close($process);
        }

        $this->assertSame(0, $exit, $errors);
        $this->assertSame(0, Authorization::query()->where('roster_record_id', $record->id)->where('status', 'active')->count(),
            'The removed athlete must not end with an active authorization.');
        $this->assertTrue($result['blocked'], 'The registration never waited for the withdrawal lock.');
        $response->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_invalid']]);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
        $this->assertDatabaseCount('waiver_acceptances', 0);
        Storage::disk('local')->assertMissing('photos/athlete.jpg');
    }
}
