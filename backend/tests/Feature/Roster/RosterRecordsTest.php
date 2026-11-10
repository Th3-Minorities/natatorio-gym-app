<?php

namespace Tests\Feature\Roster;

use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\FacilitySession;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** The athlete roster on A-05: list, search, add and edit (REQ-F-49, REQ-F-51, E-59, E-116, E-139, E-160, #21). */
class RosterRecordsTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private StaffAccount $admin;

    private const ATHLETE = [
        'name' => 'Alina Mercado Cruz', 'sport' => 'Voleibol',
        'student_number' => '802612346', 'institutional_email' => 'alina.mercado@upr.edu',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = StaffAccount::factory()->admin()->create();
    }

    private function as(StaffAccount $account, string $method, string $uri, array $data = []): TestResponse
    {
        return $this->actingAs($account, 'staff')->fromThePwa()->json($method, $uri, $data);
    }

    private function asAdmin(string $method, string $uri, array $data = []): TestResponse
    {
        return $this->as($this->admin, $method, $uri, $data);
    }

    private function athlete(array $values = []): RosterRecord
    {
        return RosterRecord::factory()->create($values);
    }

    // List and search

    public function test_the_list_shows_each_athlete_by_name_and_counts_the_active_ones(): void
    {
        $alina = $this->athlete(self::ATHLETE);
        $darel = $this->athlete(['name' => 'Darel Colón Vega', 'removed_at' => now()]);
        $amaya = $this->athlete(['name' => 'Amaya Lugo Rivera']);

        $this->asAdmin('GET', '/api/staff/roster?status=all')->assertOk()
            ->assertJsonPath('active_count', 2)
            ->assertJsonPath('total_count', 3)
            ->assertJsonPath('athletes.*.id', [$alina->id, $amaya->id, $darel->id])
            ->assertJsonPath('athletes.0', ['id' => $alina->id, ...self::ATHLETE, 'status' => 'active', 'active_session' => null])
            ->assertJsonPath('athletes.2.status', 'withdrawn');
    }

    public function test_the_status_filter_defaults_to_active(): void
    {
        $active = $this->athlete();
        $withdrawn = $this->athlete(['removed_at' => now()]);

        $this->asAdmin('GET', '/api/staff/roster')->assertJsonPath('athletes.*.id', [$active->id]);
        $this->asAdmin('GET', '/api/staff/roster?status=withdrawn')->assertJsonPath('athletes.*.id', [$withdrawn->id])
            ->assertJsonPath('active_count', 1)->assertJsonPath('total_count', 2);
        $this->asAdmin('GET', '/api/staff/roster?status=other')->assertUnprocessable()
            ->assertJsonPath('error.details.status', ['in']);
    }

    public function test_search_matches_part_of_the_name_in_any_case_or_the_student_number(): void
    {
        $alina = $this->athlete(self::ATHLETE);
        $this->athlete(['name' => 'Jairo Pagán Vélez', 'student_number' => '802523481']);

        $this->asAdmin('GET', '/api/staff/roster?search=MERCADO')->assertJsonPath('athletes.*.id', [$alina->id]);
        $this->asAdmin('GET', '/api/staff/roster?search=8026123')->assertJsonPath('athletes.*.id', [$alina->id]);
        $this->asAdmin('GET', '/api/staff/roster?search='.urlencode('  alina  '))->assertJsonPath('athletes.*.id', [$alina->id]);
    }

    /** % and _ are searched as text, not as SQL wildcards. */
    public function test_search_wildcards_match_only_themselves(): void
    {
        $this->athlete(self::ATHLETE);

        $this->asAdmin('GET', '/api/staff/roster?search=%25')->assertJsonPath('athletes', []);
        $this->asAdmin('GET', '/api/staff/roster?search=_')->assertJsonPath('athletes', []);
    }

    /** Staff read the roster without the withdrawn athletes (E-59), and the count stays the same. */
    public function test_staff_read_only_the_active_athletes(): void
    {
        $staff = StaffAccount::factory()->create();
        $active = $this->athlete();
        $this->athlete(['removed_at' => now()]);

        $this->as($staff, 'GET', '/api/staff/roster?status=all')->assertOk()
            ->assertJsonPath('athletes.*.id', [$active->id])->assertJsonPath('active_count', 1)->assertJsonPath('total_count', 1);
        $this->as($staff, 'GET', '/api/staff/roster?status=withdrawn')->assertJsonPath('athletes.*.id', [$active->id]);
    }

    // Add

    public function test_an_administrator_adds_an_athlete_and_the_log_keeps_it(): void
    {
        $response = $this->asAdmin('POST', '/api/staff/roster', self::ATHLETE)
            ->assertCreated()->assertJsonPath('athlete.status', 'active');

        $athlete = RosterRecord::query()->sole();
        $this->assertSame($athlete->id, $response->json('athlete.id'));
        $entry = AuditLogEntry::query()->where('action', 'roster.add')->sole();
        $this->assertNull($entry->before_values);
        $this->assertEquals(self::ATHLETE, $entry->after_values);
        $this->assertSame($athlete->id, $entry->subject_id);
    }

    public function test_the_fields_are_trimmed_and_the_email_is_lowercased(): void
    {
        $this->asAdmin('POST', '/api/staff/roster', [
            'name' => '  Alina Mercado Cruz ', 'sport' => ' Voleibol ',
            'student_number' => ' 802612346 ', 'institutional_email' => ' Alina.Mercado@UPR.edu ',
        ])->assertCreated()
            ->assertJsonPath('athlete.name', 'Alina Mercado Cruz')->assertJsonPath('athlete.sport', 'Voleibol')
            ->assertJsonPath('athlete.student_number', '802612346')
            ->assertJsonPath('athlete.institutional_email', 'alina.mercado@upr.edu');
    }

    public function test_the_fields_are_checked(): void
    {
        $this->asAdmin('POST', '/api/staff/roster', [])->assertUnprocessable()
            ->assertJsonPath('error.details.name', ['required'])->assertJsonPath('error.details.sport', ['required'])
            ->assertJsonPath('error.details.student_number', ['required'])
            ->assertJsonPath('error.details.institutional_email', ['required']);

        $this->asAdmin('POST', '/api/staff/roster', [
            'name' => str_repeat('a', 256), 'sport' => str_repeat('a', 51),
            'student_number' => '80261234', 'institutional_email' => 'not an email',
        ])->assertJsonPath('error.details.name', ['max'])->assertJsonPath('error.details.sport', ['max'])
            ->assertJsonPath('error.details.student_number', ['digits'])
            ->assertJsonPath('error.details.institutional_email', ['email']);

        $this->assertSame(0, RosterRecord::query()->count());
    }

    /** E-160: a UPRM student number has exactly 9 digits, and not every one starts with 802. */
    public function test_the_student_number_has_exactly_nine_digits(): void
    {
        foreach (['8026123460', '80261234a', '802-61234'] as $number) {
            $this->asAdmin('POST', '/api/staff/roster', [...self::ATHLETE, 'student_number' => $number])
                ->assertJsonPath('error.details.student_number', ['digits']);
        }
        $this->asAdmin('POST', '/api/staff/roster', [...self::ATHLETE, 'student_number' => '501234567'])->assertCreated();
    }

    /** A-05 "Número repetido" names who has it, a withdrawn athlete too: there is one roster (D16). */
    public function test_a_repeated_student_number_is_refused_and_names_the_athlete(): void
    {
        $darel = $this->athlete(['name' => 'Darel Colón Vega', 'student_number' => '802398412', 'removed_at' => now()]);

        $this->asAdmin('POST', '/api/staff/roster', [...self::ATHLETE, 'student_number' => '802398412'])
            ->assertUnprocessable()->assertExactJson(['error' => [
                'code' => 'roster_student_number_taken',
                'details' => ['athlete' => ['id' => $darel->id, 'name' => 'Darel Colón Vega']],
            ]]);
        $this->assertSame(1, RosterRecord::query()->count());
    }

    // Edit

    public function test_an_administrator_edits_an_athlete_and_the_log_keeps_what_changed(): void
    {
        $athlete = $this->athlete(self::ATHLETE);

        $this->asAdmin('PATCH', "/api/staff/roster/{$athlete->id}", [...self::ATHLETE, 'sport' => 'Natación'])
            ->assertOk()->assertJsonPath('athlete.sport', 'Natación');

        $entry = AuditLogEntry::query()->where('action', 'roster.update')->sole();
        $this->assertSame(['sport' => 'Voleibol'], $entry->before_values);
        $this->assertSame(['sport' => 'Natación'], $entry->after_values);
    }

    /**
     * A link went to the old email, maybe a wrong one. Once the email changes, it must not create the account
     * (post-merge review of #157, #137); the athlete asks for a new link, which goes to the new email.
     */
    public function test_a_new_email_cancels_the_open_links_sent_to_the_old_one(): void
    {
        $athlete = $this->athlete(self::ATHLETE);
        $registration = EmailLink::factory()->athleteRegistration()->create(['roster_record_id' => $athlete->id]);
        $soyAtleta = EmailLink::factory()->athleteLink()->create(['roster_record_id' => $athlete->id]);
        $used = EmailLink::factory()->athleteRegistration()->create(['roster_record_id' => $athlete->id, 'used_at' => now()]);
        $otherAthlete = EmailLink::factory()->athleteRegistration()->create();

        $this->asAdmin('PATCH', "/api/staff/roster/{$athlete->id}", [...self::ATHLETE, 'sport' => 'Natación'])->assertOk();
        $this->assertSame(4, EmailLink::query()->count(), 'Another field leaves the links alone.');

        $this->asAdmin('PATCH', "/api/staff/roster/{$athlete->id}", [...self::ATHLETE, 'institutional_email' => 'alina.cruz@upr.edu'])
            ->assertOk();

        $this->assertModelMissing($registration);
        $this->assertModelMissing($soyAtleta);
        $this->assertModelExists($used);
        $this->assertModelExists($otherAthlete);
    }

    public function test_saving_the_same_values_writes_no_log_entry(): void
    {
        $athlete = $this->athlete(self::ATHLETE);

        $this->asAdmin('PATCH', "/api/staff/roster/{$athlete->id}", self::ATHLETE)->assertOk();

        $this->assertSame(0, AuditLogEntry::query()->where('action', 'roster.update')->count());
    }

    public function test_an_athlete_keeps_their_own_number_but_cannot_take_another_one(): void
    {
        $athlete = $this->athlete(self::ATHLETE);
        $other = $this->athlete(['name' => 'Jairo Pagán Vélez', 'student_number' => '802523481']);

        $this->asAdmin('PATCH', "/api/staff/roster/{$athlete->id}", [...self::ATHLETE, 'name' => 'Alina Mercado'])->assertOk();
        $this->asAdmin('PATCH', "/api/staff/roster/{$athlete->id}", [...self::ATHLETE, 'student_number' => '802523481'])
            ->assertUnprocessable()->assertJsonPath('error.details.athlete.id', $other->id);
    }

    public function test_an_unknown_athlete_is_not_found(): void
    {
        $this->asAdmin('PATCH', '/api/staff/roster/999', self::ATHLETE)->assertNotFound()->assertJsonPath('error.code', 'not_found');
    }

    // Who may call it

    public function test_staff_cannot_add_or_edit(): void
    {
        $staff = StaffAccount::factory()->create();
        $athlete = $this->athlete();

        $this->as($staff, 'POST', '/api/staff/roster', self::ATHLETE)->assertForbidden()->assertJsonPath('error.code', 'forbidden');
        $this->as($staff, 'PATCH', "/api/staff/roster/{$athlete->id}", self::ATHLETE)->assertForbidden();
        $this->assertSame(1, RosterRecord::query()->count());
    }

    public function test_a_signed_out_request_is_refused(): void
    {
        $this->fromThePwa()->getJson('/api/staff/roster')->assertUnauthorized();
    }

    /** S-05 (#26): Staff compare the photo and start an assisted Check In, so the email stays on A-05 (Administrators). */
    public function test_the_email_goes_to_administrators_and_not_to_staff(): void
    {
        $this->athlete(self::ATHLETE);

        $this->asAdmin('GET', '/api/staff/roster')->assertOk()
            ->assertJsonPath('athletes.0.institutional_email', 'alina.mercado@upr.edu');
        $staff = $this->as(StaffAccount::factory()->create(), 'GET', '/api/staff/roster')->assertOk();
        $this->assertArrayNotHasKey('institutional_email', $staff->json('athletes.0'));
        $this->assertStringNotContainsString('alina.mercado@upr.edu', $staff->getContent());
    }

    /** S-05 shows "Entrada registrada" for an athlete who is inside now, and nothing else about the visit. */
    public function test_staff_and_administrators_see_when_an_athlete_visit_started(): void
    {
        $this->travelTo(now()->startOfSecond());
        $inside = $this->athlete(['name' => 'Alina Mercado Cruz']);
        $out = $this->athlete(['name' => 'Beatriz Soto Ruiz']);
        $never = $this->athlete(['name' => 'Camila Rivera Santiago']);
        $user = User::factory()->create();
        Authorization::factory()->athlete($inside)->create(['user_id' => $user->id]);
        FacilitySession::factory()->startedMinutesAgo(30)->create(['user_id' => $user->id]);
        $other = User::factory()->create();
        Authorization::factory()->athlete($out)->create(['user_id' => $other->id]);
        FacilitySession::factory()->startedMinutesAgo(50)->checkedOut(20)->create(['user_id' => $other->id]);

        foreach ([StaffAccount::factory()->create(), $this->admin] as $account) {
            $response = $this->as($account, 'GET', '/api/staff/roster')->assertOk()
                ->assertJsonPath('athletes.*.id', [$inside->id, $out->id, $never->id])
                ->assertJsonPath('athletes.0.active_session', ['started_at' => now()->subMinutes(30)->toISOString()])
                ->assertJsonPath('athletes.1.active_session', null)
                ->assertJsonPath('athletes.2.active_session', null);
            $this->assertSame(['started_at'], array_keys($response->json('athletes.0.active_session')));
        }
    }

    public function test_a_user_sign_in_does_not_grant_the_staff_roster(): void
    {
        $user = User::factory()->create(['current_session_id' => 'device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa()
            ->getJson('/api/staff/roster')->assertUnauthorized();
    }

    /** Staff search is answered as plain data too, with the new field in the answer. */
    #[DataProvider('injections')]
    public function test_staff_search_with_an_injection_string_is_plain_data(string $text): void
    {
        $this->athlete(self::ATHLETE);

        $this->as(StaffAccount::factory()->create(), 'GET', '/api/staff/roster?search='.urlencode($text))->assertOk()
            ->assertJsonPath('athletes', [])->assertJsonPath('active_count', 1);
        $this->assertSame(1, RosterRecord::query()->count());
    }

    /** @return array<string, array{string}> */
    public static function injections(): array
    {
        return ['SQL' => ["' OR '1'='1"], 'script' => ['<script>alert(1)</script>']];
    }

    #[DataProvider('injections')]
    public function test_injection_in_the_name_and_sport_is_kept_as_plain_text(string $text): void
    {
        $this->asAdmin('POST', '/api/staff/roster', [...self::ATHLETE, 'name' => $text, 'sport' => mb_substr($text, 0, 50)])
            ->assertCreated()->assertJsonPath('athlete.name', $text);
    }

    #[DataProvider('injections')]
    public function test_injection_in_the_number_email_search_and_id_is_refused_or_finds_nothing(string $text): void
    {
        $this->athlete(self::ATHLETE);

        $this->asAdmin('POST', '/api/staff/roster', [...self::ATHLETE, 'student_number' => $text, 'institutional_email' => $text])
            ->assertJsonPath('error.details.student_number', ['digits'])
            ->assertJsonPath('error.details.institutional_email', ['email']);
        $this->asAdmin('GET', '/api/staff/roster?status=all&search='.urlencode($text))->assertOk()->assertJsonPath('athletes', []);
        $this->asAdmin('PATCH', '/api/staff/roster/'.rawurlencode($text), self::ATHLETE)->assertNotFound();
        $this->assertSame(1, RosterRecord::query()->count());
    }
}
