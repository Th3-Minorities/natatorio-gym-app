<?php

namespace Tests\Feature\Auth;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Services\RegistrationPhoto;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\Concerns\InsertsAtTheSameTime;
use Tests\TestCase;

/**
 * An Administrator's roster action and the athlete's last registration step at the same moment (#163, #181). The
 * action runs through the real route in a second process, which holds the roster record until the registration
 * waits behind it, so a change to the lock order or to the action itself shows up here.
 */
class AthleteRosterConcurrencyTest extends TestCase
{
    use CallsTheApiFromThePwa, DatabaseTruncation, InsertsAtTheSameTime;

    private RosterRecord $record;

    private StaffAccount $admin;

    protected function setUp(): void
    {
        parent::setUp();
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
        $this->record = RosterRecord::factory()->create(['institutional_email' => 'marta.ruiz@upr.edu']);
        EmailLink::factory()->create(['roster_record_id' => $this->record->id, 'token_hash' => hash('sha256', 'tok')]);
        $this->admin = StaffAccount::factory()->admin()->create();
        $notice = $this->getJson('/api/user/registration/privacy')->assertOk();
        $this->postJson('/api/user/registration/privacy', ['version' => $notice->json('version')])->assertNoContent();
    }

    protected function tearDown(): void
    {
        $this->emptyEveryTable();

        parent::tearDown();
    }

    public function test_a_registration_that_finishes_during_a_withdrawal_waits_for_it_and_is_refused(): void
    {
        [$response, $action] = $this->registerDuring('withdraw');

        $this->assertSame(200, $action['status'], $action['body']);
        $this->assertNotNull($this->record->fresh()->removed_at);
        $this->assertSame(1, AuditLogEntry::query()->where('action', 'roster.withdraw')->count());
        $this->assertSame(0, Authorization::query()->where('roster_record_id', $this->record->id)->where('status', 'active')->count(),
            'The removed athlete must not end with an active authorization.');
        $response->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_invalid']]);
        $this->assertNothingCreated();
    }

    public function test_a_registration_that_finishes_during_an_email_edit_waits_for_it_and_is_refused(): void
    {
        [$response, $action] = $this->registerDuring('email', [
            'name' => $this->record->name, 'sport' => $this->record->sport,
            'student_number' => $this->record->student_number, 'institutional_email' => 'marta.ruiz.nueva@upr.edu',
        ]);

        // Both requests end as the app means them to: neither one is aborted by a deadlock.
        $this->assertSame(200, $action['status'], $action['body']);
        $this->assertSame('marta.ruiz.nueva@upr.edu', $this->record->fresh()->institutional_email);
        $this->assertDatabaseCount('email_links', 0);
        $response->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_invalid']]);
        $this->assertNothingCreated();
    }

    /**
     * Starts the Administrator's action in a second process, finishes the registration while that process holds
     * the roster record, and returns both answers.
     *
     * @param  array<string, string>  $fields
     * @return array{0: TestResponse, 1: array{blocked: bool, status: int, body: string}}
     */
    private function registerDuring(string $action, array $fields = []): array
    {
        $process = proc_open(
            [PHP_BINARY, base_path('tests/Support/roster-action-holder.php')],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
        );
        fwrite($pipes[0], json_encode([
            'connection' => config('database.connections.'.config('database.default')),
            'roster_record_id' => $this->record->id, 'admin_id' => $this->admin->id,
            'action' => $action, 'fields' => $fields,
        ], JSON_THROW_ON_ERROR));
        fclose($pipes[0]);

        try {
            $this->assertSame('locked', trim((string) fgets($pipes[1])));
            $response = $this->post('/api/user/registration/athlete/complete', [
                'token' => 'tok', 'password' => 'a long password', 'password_confirmation' => 'a long password',
                'photo' => UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')),
                'waiver_accepted' => true, 'waiver_version' => 'test-v1',
                'emergency_contact_name' => 'Ana Rodríguez', 'emergency_contact_phone' => '787 555 0100', 'locale' => 'es',
            ], ['Accept' => 'application/json']);
            $output = trim(stream_get_contents($pipes[1]));
        } finally {
            $errors = trim(stream_get_contents($pipes[2]));
            fclose($pipes[1]);
            fclose($pipes[2]);
            $exit = proc_close($process);
        }

        $this->assertSame(0, $exit, $errors);
        $result = json_decode($output, true, flags: JSON_THROW_ON_ERROR);
        $this->assertTrue($result['blocked'], 'The registration did not wait for the roster record.');

        return [$response, $result];
    }

    private function assertNothingCreated(): void
    {
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
        $this->assertDatabaseCount('waiver_acceptances', 0);
        Storage::disk('local')->assertMissing('photos/athlete.jpg');
    }
}
