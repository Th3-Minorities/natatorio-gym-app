<?php

namespace Tests\Feature\CheckIn;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/**
 * S-02 "Persona y sesión" (Figma 121:3142, #26): who the visit belongs to, with what Staff may see (REQ-NF-19), and
 * the corrections on an active visit: end it early or void it (REQ-F-48), and mark the photo pending (REQ-F-94).
 */
class StaffSessionDetailTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private StaffAccount $staff;

    private User $user;

    private Authorization $authorization;

    private FacilitySession $session;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->startOfSecond());
        // A term around today, so the authorization is current whatever terms earlier tests prepared.
        AcademicTerm::factory()->create(['starts_on' => today()->subMonth(), 'ends_on' => today()->addMonth()]);
        $this->staff = StaffAccount::factory()->create();
        $this->user = User::factory()->create(['email' => 'camila.rivera@example.com']);
        WaiverAcceptance::factory()->create([
            'user_id' => $this->user->id, 'full_name' => 'Camila Rivera Santiago', 'waiver_version' => '3',
            'emergency_contact_name' => 'Marisol Santiago', 'emergency_contact_phone' => '787-555-0146',
            'accepted_at' => now()->subDays(10),
        ]);
        $record = RosterRecord::factory()->create(['student_number' => '802612345', 'sport' => 'Baloncesto femenino']);
        $this->authorization = Authorization::factory()->athlete($record)->create(['user_id' => $this->user->id]);
        $this->session = FacilitySession::factory()->athlete('Baloncesto femenino')->startedMinutesAgo(74)
            ->create(['user_id' => $this->user->id, 'authorization_id' => $this->authorization->id]);
    }

    private function send(string $method, string $uri, ?StaffAccount $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->staff, 'staff')->fromThePwa()->json($method, $uri);
    }

    public function test_the_detail_shows_the_person_and_the_visit_and_nothing_else_sensitive(): void
    {
        $response = $this->send('GET', "/api/staff/sessions/{$this->session->id}")->assertOk()
            ->assertJsonPath('session.id', $this->session->id)
            ->assertJsonPath('session.status', 'active')
            ->assertJsonPath('session.started_at', now()->subMinutes(74)->toISOString())
            ->assertJsonPath('person.user_id', $this->user->id)
            ->assertJsonPath('person.name', 'Camila Rivera Santiago')
            ->assertJsonPath('person.student_number', '802612345')
            ->assertJsonPath('person.type', 'athlete')
            ->assertJsonPath('person.sport', 'Baloncesto femenino')
            ->assertJsonPath('person.authorization.current', true)
            ->assertJsonPath('person.waiver.version', '3')
            ->assertJsonPath('person.waiver.accepted_at', now()->subDays(10)->toISOString())
            ->assertJsonPath('person.emergency_contact', ['name' => 'Marisol Santiago', 'phone' => '787-555-0146'])
            ->assertJsonPath('person.photo_pending', false)
            ->assertJsonPath('person.has_photo', true);

        // REQ-NF-19: no email and no other personal data.
        $this->assertStringNotContainsString('camila.rivera@example.com', $response->getContent());
        $this->assertSame(['session', 'person'], array_keys($response->json()));
    }

    public function test_a_finished_visit_still_opens_with_how_it_ended(): void
    {
        $this->session->update(['status' => 'checked_out', 'ended_at' => now()]);

        $this->send('GET', "/api/staff/sessions/{$this->session->id}")->assertOk()
            ->assertJsonPath('session.status', 'checked_out')
            ->assertJsonPath('session.ended_at', now()->toISOString());
    }

    public function test_an_unknown_visit_is_not_found(): void
    {
        $this->send('GET', '/api/staff/sessions/999999')->assertNotFound()->assertJsonPath('error.code', 'not_found');
    }

    /** @return array<string, array{string, string, string}> */
    public static function corrections(): array
    {
        return [
            'end early' => ['end-early', 'ended_early', 'session.end_early'],
            'void' => ['void', 'void', 'session.void'],
        ];
    }

    #[DataProvider('corrections')]
    public function test_staff_correct_an_active_visit_and_the_log_names_them(string $path, string $status, string $action): void
    {
        $this->send('POST', "/api/staff/sessions/{$this->session->id}/{$path}")->assertOk()
            ->assertJsonPath('session.status', $status);
        // The database writes its own clock, so only check that the end is set.
        $this->assertNotNull($this->session->fresh()->ended_at);

        $this->assertSame($status, $this->session->fresh()->status);
        $this->flushSession();
        $this->send('GET', '/api/staff/occupancy')->assertJsonPath('count', 0);

        $entry = AuditLogEntry::query()->where('action', $action)->sole();
        $this->assertSame($this->staff->id, $entry->staff_account_id);
        $this->assertEquals(['status' => 'active'], $entry->before_values);
        $this->assertEquals(['status' => $status], $entry->after_values);
    }

    #[DataProvider('corrections')]
    public function test_only_an_active_visit_can_be_corrected(string $path, string $status, string $action): void
    {
        $this->session->update(['status' => 'checked_out', 'ended_at' => now()]);

        $this->send('POST', "/api/staff/sessions/{$this->session->id}/{$path}")->assertStatus(409)
            ->assertJsonPath('error.code', 'check_out_session_not_active');
        $this->assertSame(0, AuditLogEntry::query()->where('action', $action)->count());
    }

    #[DataProvider('corrections')]
    public function test_a_visit_past_its_two_hours_is_no_longer_active(string $path, string $status, string $action): void
    {
        // The service reads the database clock, so the visit is made in the past instead of travelling in time.
        $old = FacilitySession::factory()->startedMinutesAgo(130)->create(['user_id' => User::factory()->create()->id]);

        $this->send('POST', "/api/staff/sessions/{$old->id}/{$path}")->assertStatus(409);
    }

    public function test_staff_mark_the_photo_pending_once_and_the_visit_stays_open(): void
    {
        $this->send('POST', "/api/staff/people/{$this->user->id}/photo-pending")->assertOk()
            ->assertJsonPath('person.photo_pending', true);
        $this->flushSession();
        $this->send('POST', "/api/staff/people/{$this->user->id}/photo-pending")->assertOk();

        $this->assertNotNull($this->authorization->fresh()->photo_pending_at);
        $this->assertSame('active', $this->session->fresh()->status, 'The mark does not end the visit (122:3094).');
        $entry = AuditLogEntry::query()->where('action', 'photo.pending')->sole();
        $this->assertSame($this->staff->id, $entry->staff_account_id);
    }

    public function test_a_person_without_a_current_authorization_cannot_be_marked(): void
    {
        $this->authorization->update(['status' => 'revoked']);

        $this->send('POST', "/api/staff/people/{$this->user->id}/photo-pending")->assertStatus(409)
            ->assertJsonPath('error.code', 'check_in_no_authorization');
        $this->flushSession();
        $this->send('POST', '/api/staff/people/999999/photo-pending')->assertNotFound();
    }

    /** @return array<string, array{string, string}> */
    public static function routes(): array
    {
        return [
            'detail' => ['GET', '/api/staff/sessions/1'],
            'end early' => ['POST', '/api/staff/sessions/1/end-early'],
            'void' => ['POST', '/api/staff/sessions/1/void'],
            'photo pending' => ['POST', '/api/staff/people/1/photo-pending'],
        ];
    }

    #[DataProvider('routes')]
    public function test_sign_in_is_required(string $method, string $uri): void
    {
        $this->fromThePwa()->json($method, $uri)->assertUnauthorized();
    }

    public function test_administrators_can_do_it_too(): void
    {
        $this->send('POST', "/api/staff/sessions/{$this->session->id}/end-early", StaffAccount::factory()->admin()->create())
            ->assertOk();
    }
}
