<?php

namespace Tests\Feature\CheckIn;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\RosterRecord;
use App\Models\ScheduleSlot;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/**
 * S-03 "Buscar persona y Check in asistido" (Figma 4283:1011, REQ-F-46, #26): find a paid member by name or an
 * athlete by student number, compare the photo, and enter them with the same rules as their own Check In, minus the
 * location. Each one is logged as an exception (REQ-NF-39).
 */
class StaffAssistedCheckInTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private StaffAccount $staff;

    protected function setUp(): void
    {
        parent::setUp();
        // The real clock: a visit here starts at the database's now(), and occupancy counts by the app's clock.
        $this->travelBack();
        // A term around today, so authorizations are current whatever terms earlier tests prepared.
        AcademicTerm::factory()->create(['starts_on' => today()->subMonth(), 'ends_on' => today()->addMonth()]);
        // Open all day today. No time travel: the sessions service reads the database clock.
        ScheduleSlot::factory()->create(['type' => 'regular_hours', 'weekday' => now()->dayOfWeek, 'start_time' => '00:00', 'end_time' => '23:59:59']);
        $this->staff = StaffAccount::factory()->create();
    }

    private function send(string $method, string $uri, array $data = []): TestResponse
    {
        return $this->actingAs($this->staff, 'staff')->fromThePwa()->json($method, $uri, $data);
    }

    private function person(string $name, ?Authorization $authorization = null, string $email = 'person@example.com'): User
    {
        $user = User::factory()->create(['email' => $email]);
        WaiverAcceptance::factory()->create(['user_id' => $user->id, 'full_name' => $name]);
        if ($authorization) {
            $authorization->update(['user_id' => $user->id]);
        }

        return $user;
    }

    private function athlete(string $number = '802612345'): User
    {
        $record = RosterRecord::factory()->create(['student_number' => $number, 'sport' => 'Voleibol']);

        return $this->person('Camila Rivera Santiago', Authorization::factory()->athlete($record)->create(), 'camila@example.com');
    }

    public function test_an_athlete_is_found_by_student_number(): void
    {
        $camila = $this->athlete();

        $response = $this->send('GET', '/api/staff/people?search=802612345')->assertOk()
            ->assertJsonPath('people.*.user_id', [$camila->id])
            ->assertJsonPath('people.0.student_number', '802612345')
            ->assertJsonPath('people.0.type', 'athlete')
            ->assertJsonPath('people.0.authorization.current', true)
            ->assertJsonPath('people.0.active_session', null);

        $this->assertStringNotContainsString('camila@example.com', $response->getContent());
        $this->assertArrayNotHasKey('emergency_contact', $response->json('people.0'), 'Only S-02 shows it.');
    }

    public function test_a_paid_member_is_found_by_part_of_the_name(): void
    {
        $luis = $this->person('Luis Méndez', Authorization::factory()->paid()->create());
        $this->person('Elena Santiago', Authorization::factory()->paid()->create(), 'elena@example.com');

        // Two people can share a name, so each match carries the email, masked as on every Staff screen (E-72, 4288:1573).
        $this->send('GET', '/api/staff/people?search=m%C3%A9ndez')->assertOk()->assertJsonPath('people.*.user_id', [$luis->id])
            ->assertJsonPath('people.0.masked_email', 'p***n@example.com');
    }

    /** @return list<string> the SQL of every query $run sends */
    private function queriesOf(callable $run): array
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $run();
        DB::disableQueryLog();

        return array_column(DB::getQueryLog(), 'query');
    }

    public function test_a_search_sends_the_same_number_of_queries_for_one_match_or_ten(): void
    {
        foreach (range(1, 10) as $number) {
            $this->person("Socio Lote {$number}", Authorization::factory()->paid()->create(), "lote{$number}@example.com");
        }
        $one = $this->queriesOf(fn () => $this->send('GET', '/api/staff/people?search='.urlencode('Lote 1'))->assertOk()
            ->assertJsonCount(2, 'people'));
        $this->flushSession();
        $ten = $this->queriesOf(fn () => $this->send('GET', '/api/staff/people?search='.urlencode('Socio Lote'))->assertOk()
            ->assertJsonCount(10, 'people'));

        $this->assertSame(count($one), count($ten));
    }

    public function test_a_student_number_answers_with_ten_people_at_most(): void
    {
        $record = RosterRecord::factory()->create(['student_number' => '802600001']);
        $ids = [];
        foreach (range(1, 12) as $number) {
            // One term per year, as the roster is imported each term, so the same number can belong to many accounts.
            $term = AcademicTerm::factory()->create(['starts_on' => today()->subYears($number + 1), 'ends_on' => today()->subYears($number + 1)->addMonth()]);
            $ids[] = $this->person("Cuenta {$number}", Authorization::factory()->athlete($record)->create(['academic_term_id' => $term->id]), "cuenta{$number}@example.com")->id;
        }

        // The cut is stable: always the ten newest accounts.
        $response = $this->send('GET', '/api/staff/people?search=802600001')->assertOk()->assertJsonCount(10, 'people');
        $found = $response->json('people.*.user_id');
        sort($found);
        rsort($ids);
        $expected = array_slice($ids, 0, 10);
        sort($expected);
        $this->assertSame($expected, $found);
    }

    public function test_the_schedule_is_read_once_for_an_assisted_check_in(): void
    {
        $member = $this->person('Socio Pagado', Authorization::factory()->paid()->create(['photo_path' => 'photos/socio.jpg']), 'socio@example.com');

        $queries = $this->queriesOf(fn () => $this->send('POST', '/api/staff/check-in', ['user_id' => $member->id])->assertCreated());

        $this->assertCount(1, array_filter($queries, fn (string $sql) => str_contains($sql, 'from "schedule_slots"')));
    }

    public function test_a_search_finds_nobody_for_an_unknown_number_or_wildcards(): void
    {
        $this->athlete();
        // A roster record nobody claimed has no account to enter with.
        RosterRecord::factory()->create(['student_number' => '802000099']);

        foreach (['802999999', '802000099', '%', '_', "' OR 1=1 --"] as $text) {
            $this->flushSession();
            $this->send('GET', '/api/staff/people?search='.urlencode($text))->assertOk()->assertJsonPath('people', []);
        }
    }

    public function test_the_search_is_checked(): void
    {
        $this->send('GET', '/api/staff/people')->assertUnprocessable()->assertJsonPath('error.details.search', ['required']);
        $this->flushSession();
        $this->send('GET', '/api/staff/people?search='.str_repeat('a', 256))->assertUnprocessable()
            ->assertJsonPath('error.details.search', ['max']);
    }

    public function test_the_search_shows_an_open_visit(): void
    {
        $camila = $this->athlete();
        $session = FacilitySession::factory()->athlete()->startedMinutesAgo(20)->create(['user_id' => $camila->id]);

        $this->send('GET', '/api/staff/people?search=802612345')->assertJsonPath('people.0.active_session.id', $session->id);
    }

    public function test_staff_see_the_photo_of_the_current_authorization_only(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('photos/camila.jpg', 'jpeg bytes');
        $camila = $this->athlete();
        Authorization::query()->where('user_id', $camila->id)->update(['photo_path' => 'photos/camila.jpg']);

        $response = $this->send('GET', "/api/staff/people/{$camila->id}/photo")->assertOk();
        $this->assertSame('jpeg bytes', $response->streamedContent());
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));

        Authorization::query()->where('user_id', $camila->id)->update(['status' => 'revoked']);
        $this->flushSession();
        $this->send('GET', "/api/staff/people/{$camila->id}/photo")->assertNotFound();
    }

    public function test_staff_enter_a_person_without_a_phone_and_the_log_marks_it(): void
    {
        $camila = $this->athlete();

        $this->send('POST', '/api/staff/check-in', ['user_id' => $camila->id])->assertCreated()
            ->assertJsonPath('session.status', 'active');

        $session = FacilitySession::query()->sole();
        $this->assertTrue($session->assisted);
        $this->assertSame('athlete', $session->authorization_type);
        $this->assertSame('Voleibol', $session->sport);
        $entry = AuditLogEntry::query()->where('action', 'check_in.assisted')->sole();
        $this->assertSame($this->staff->id, $entry->staff_account_id);
        // started_at is stored to the second, rounded, so the count is read a second later.
        $this->travel(1)->seconds();
        $this->flushSession();
        $this->send('GET', '/api/staff/occupancy')->assertJsonPath('count', 1);
    }

    public function test_a_second_visit_is_refused_and_names_the_open_one(): void
    {
        $camila = $this->athlete();
        $open = FacilitySession::factory()->athlete()->startedMinutesAgo(20)->create(['user_id' => $camila->id]);

        $this->send('POST', '/api/staff/check-in', ['user_id' => $camila->id])->assertStatus(409)
            ->assertJsonPath('error.code', 'check_in_session_active')
            ->assertJsonPath('error.details.session.id', $open->id);
        $this->assertSame(1, FacilitySession::query()->count());
        $this->assertSame(0, AuditLogEntry::query()->count());
    }

    public function test_the_same_rules_as_check_in_apply(): void
    {
        $nobody = $this->person('Sin Autorización', null, 'none@example.com');
        $this->send('POST', '/api/staff/check-in', ['user_id' => $nobody->id])->assertForbidden()
            ->assertJsonPath('error.code', 'check_in_no_authorization');

        $pending = $this->person('Foto Pendiente', Authorization::factory()->paid()->create(['photo_pending_at' => now()]), 'p@example.com');
        $this->flushSession();
        $this->send('POST', '/api/staff/check-in', ['user_id' => $pending->id])->assertStatus(409)
            ->assertJsonPath('error.code', 'check_in_photo_pending');

        $member = $this->person('Socio Pagado', Authorization::factory()->paid()->create(), 'm@example.com');
        $athletesOnly = ScheduleSlot::factory()->create(['type' => 'athletes_only', 'weekday' => now()->dayOfWeek, 'start_time' => '00:00', 'end_time' => '23:59:59']);
        $this->flushSession();
        $this->send('POST', '/api/staff/check-in', ['user_id' => $member->id])->assertStatus(409)
            ->assertJsonPath('error.code', 'check_in_athletes_only');

        $athletesOnly->delete();
        ScheduleSlot::factory()->dated()->create(['starts_at' => now()->subHour(), 'ends_at' => now()->addHour()]);
        $this->flushSession();
        $this->send('POST', '/api/staff/check-in', ['user_id' => $this->athlete('802612399')->id])->assertStatus(409)
            ->assertJsonPath('error.code', 'check_in_gym_closed');
        $this->assertSame(0, FacilitySession::query()->count());
    }

    public function test_the_person_is_checked(): void
    {
        $this->send('POST', '/api/staff/check-in', [])->assertUnprocessable()->assertJsonPath('error.details.user_id', ['required']);
        $this->flushSession();
        $this->send('POST', '/api/staff/check-in', ['user_id' => 'abc'])->assertUnprocessable();
        $this->flushSession();
        $this->send('POST', '/api/staff/check-in', ['user_id' => 999999])->assertNotFound()->assertJsonPath('error.code', 'not_found');
    }

    public function test_sign_in_is_required(): void
    {
        $this->fromThePwa()->getJson('/api/staff/people?search=a')->assertUnauthorized();
        $this->fromThePwa()->getJson('/api/staff/people/1/photo')->assertUnauthorized();
        $this->fromThePwa()->postJson('/api/staff/check-in', ['user_id' => 1])->assertUnauthorized();
    }
}
