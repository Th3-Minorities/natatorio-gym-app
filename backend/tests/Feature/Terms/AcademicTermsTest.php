<?php

namespace Tests\Feature\Terms;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** An Administrator creates and edits academic terms on A-04 (REQ-F-21, E-88, E-107, #21). */
class AcademicTermsTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private StaffAccount $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-08 10:00:00');
        $this->admin = StaffAccount::factory()->admin()->create();
    }

    private function asAdmin(string $method, string $uri, array $data = []): TestResponse
    {
        return $this->actingAs($this->admin, 'staff')->fromThePwa()->json($method, $uri, $data);
    }

    private function term(string $name, string $startsOn, string $endsOn): AcademicTerm
    {
        return AcademicTerm::query()->create(['name' => $name, 'starts_on' => $startsOn, 'ends_on' => $endsOn]);
    }

    // List

    public function test_the_list_gives_each_term_its_state_newest_first(): void
    {
        $this->term('Enero - mayo 2026', '2026-01-12', '2026-05-15');
        $current = $this->term('Agosto - diciembre 2026', '2026-08-10', '2026-12-18');
        $this->term('Enero - mayo 2027', '2027-01-11', '2027-05-14');

        $this->asAdmin('GET', '/api/staff/terms')->assertOk()->assertExactJson(['terms' => [
            ['id' => $current->id + 1, 'name' => 'Enero - mayo 2027', 'starts_on' => '2027-01-11', 'ends_on' => '2027-05-14', 'status' => 'upcoming'],
            ['id' => $current->id, 'name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18', 'status' => 'active'],
            ['id' => $current->id - 1, 'name' => 'Enero - mayo 2026', 'starts_on' => '2026-01-12', 'ends_on' => '2026-05-15', 'status' => 'past'],
        ]]);
    }

    public function test_a_term_is_active_on_its_first_and_last_day(): void
    {
        $this->term('Hoy empieza', '2026-11-08', '2026-11-20');
        $this->asAdmin('GET', '/api/staff/terms')->assertJsonPath('terms.0.status', 'active');

        // A new sign-in each time: an Administrator sign-in ends after 20 idle minutes (E-130).
        $this->travelTo('2026-11-20 23:59:00');
        $this->flushSession();
        $this->asAdmin('GET', '/api/staff/terms')->assertJsonPath('terms.0.status', 'active');

        $this->travelTo('2026-11-21 00:00:00');
        $this->flushSession();
        $this->asAdmin('GET', '/api/staff/terms')->assertJsonPath('terms.0.status', 'past');
    }

    // Create

    public function test_an_administrator_creates_a_term_and_the_log_keeps_it(): void
    {
        $response = $this->asAdmin('POST', '/api/staff/terms', [
            'name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18',
        ])->assertCreated()->assertJsonPath('term.status', 'active')->assertJsonPath('term.ends_on', '2026-12-18');

        $term = AcademicTerm::query()->sole();
        $this->assertSame($term->id, $response->json('term.id'));
        $entry = AuditLogEntry::query()->where('action', 'term.create')->sole();
        $this->assertNull($entry->before_values);
        // assertEquals: jsonb keeps the keys in its own order.
        $this->assertEquals(['name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18'], $entry->after_values);
        $this->assertSame($term->id, $entry->subject_id);
        $this->assertSame($this->admin->id, $entry->staff_account_id);
    }

    public function test_a_one_day_term_is_allowed(): void
    {
        $this->asAdmin('POST', '/api/staff/terms', ['name' => 'Un día', 'starts_on' => '2026-12-01', 'ends_on' => '2026-12-01'])
            ->assertCreated();
    }

    public function test_the_fields_are_checked(): void
    {
        $this->asAdmin('POST', '/api/staff/terms', [])->assertUnprocessable()
            ->assertJsonPath('error.details.name', ['required'])
            ->assertJsonPath('error.details.starts_on', ['required'])
            ->assertJsonPath('error.details.ends_on', ['required']);

        $this->asAdmin('POST', '/api/staff/terms', ['name' => str_repeat('a', 51), 'starts_on' => '2026-13-01', 'ends_on' => '10/12/2026'])
            ->assertJsonPath('error.details.name', ['max'])
            ->assertJsonPath('error.details.starts_on', ['date_format'])
            ->assertJsonPath('error.details.ends_on', ['date_format']);

        $this->assertSame(0, AcademicTerm::query()->count());
    }

    public function test_the_end_cannot_come_before_the_start(): void
    {
        $this->asAdmin('POST', '/api/staff/terms', ['name' => 'Al revés', 'starts_on' => '2026-12-18', 'ends_on' => '2026-08-10'])
            ->assertUnprocessable()->assertJsonPath('error.details.ends_on', ['after_or_equal']);
    }

    /** Both ends count (A-04 "Solapamiento"): a term may start the day after another ends, not on that day. */
    public function test_an_overlap_is_refused_and_names_the_other_term(): void
    {
        $this->term('Agosto - diciembre 2026', '2026-08-10', '2026-12-18');

        $this->asAdmin('POST', '/api/staff/terms', ['name' => 'Verano 2026', 'starts_on' => '2026-12-18', 'ends_on' => '2027-01-10'])
            ->assertUnprocessable()->assertExactJson(['error' => [
                'code' => 'term_overlap',
                'details' => ['term' => ['name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18']],
            ]]);
        $this->asAdmin('POST', '/api/staff/terms', ['name' => 'Todo el año', 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31'])
            ->assertJsonPath('error.code', 'term_overlap');

        $this->asAdmin('POST', '/api/staff/terms', ['name' => 'Verano 2026', 'starts_on' => '2026-12-19', 'ends_on' => '2027-01-10'])
            ->assertCreated();
        // Only the term that was saved has a log entry.
        $this->assertSame(1, AuditLogEntry::query()->where('action', 'term.create')->count());
    }

    // Edit

    public function test_an_administrator_edits_a_term_and_the_log_keeps_both_versions(): void
    {
        $term = $this->term('Agosto - diciembre 2026', '2026-08-10', '2026-12-18');

        $this->asAdmin('PATCH', "/api/staff/terms/{$term->id}", ['name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-11'])
            ->assertOk()->assertJsonPath('term.ends_on', '2026-12-11');

        $this->assertSame('2026-12-11', $term->fresh()->ends_on->toDateString());
        $entry = AuditLogEntry::query()->where('action', 'term.update')->sole();
        $this->assertSame(['ends_on' => '2026-12-18'], $entry->before_values);
        $this->assertSame(['ends_on' => '2026-12-11'], $entry->after_values);
    }

    public function test_a_term_does_not_overlap_itself_but_does_overlap_its_neighbour(): void
    {
        $spring = $this->term('Enero - mayo 2026', '2026-01-12', '2026-05-15');
        $fall = $this->term('Agosto - diciembre 2026', '2026-08-10', '2026-12-18');

        $this->asAdmin('PATCH', "/api/staff/terms/{$fall->id}", ['name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-03', 'ends_on' => '2026-12-18'])
            ->assertOk();
        $this->asAdmin('PATCH', "/api/staff/terms/{$fall->id}", ['name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-05-15', 'ends_on' => '2026-12-18'])
            ->assertUnprocessable()->assertJsonPath('error.details.term.name', $spring->name);
    }

    public function test_saving_the_same_values_writes_no_log_entry(): void
    {
        $term = $this->term('Agosto - diciembre 2026', '2026-08-10', '2026-12-18');

        $this->asAdmin('PATCH', "/api/staff/terms/{$term->id}", ['name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18'])
            ->assertOk();

        $this->assertSame(0, AuditLogEntry::query()->where('action', 'term.update')->count());
    }

    public function test_an_unknown_term_is_not_found(): void
    {
        $this->asAdmin('PATCH', '/api/staff/terms/999', ['name' => 'X', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18'])
            ->assertNotFound()->assertJsonPath('error.code', 'not_found');
    }

    public function test_terms_are_never_deleted(): void
    {
        $term = $this->term('Agosto - diciembre 2026', '2026-08-10', '2026-12-18');

        $this->asAdmin('DELETE', "/api/staff/terms/{$term->id}")->assertStatus(405);
        $this->assertNotNull($term->fresh());
    }

    // Who may call it

    public function test_staff_cannot_see_or_change_terms(): void
    {
        $staff = StaffAccount::factory()->create();
        $term = $this->term('Agosto - diciembre 2026', '2026-08-10', '2026-12-18');

        foreach ([['GET', '/api/staff/terms'], ['POST', '/api/staff/terms'], ['PATCH', "/api/staff/terms/{$term->id}"]] as [$method, $uri]) {
            $this->actingAs($staff, 'staff')->fromThePwa()->json($method, $uri, [])
                ->assertForbidden()->assertJsonPath('error.code', 'forbidden');
        }
    }

    public function test_a_signed_out_request_is_refused(): void
    {
        $this->fromThePwa()->getJson('/api/staff/terms')->assertUnauthorized();
    }

    // Injection (#21 "Done when")

    /** @return array<string, array{string}> */
    public static function injections(): array
    {
        return ['SQL' => ["' OR '1'='1"], 'script' => ['<script>alert(1)</script>']];
    }

    #[DataProvider('injections')]
    public function test_injection_in_the_name_is_kept_as_plain_text(string $text): void
    {
        $this->asAdmin('POST', '/api/staff/terms', ['name' => $text, 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18'])
            ->assertCreated()->assertJsonPath('term.name', $text);

        $this->assertSame(1, AcademicTerm::query()->count());
    }

    #[DataProvider('injections')]
    public function test_injection_in_the_dates_and_the_id_is_refused(string $text): void
    {
        $this->asAdmin('POST', '/api/staff/terms', ['name' => 'X', 'starts_on' => $text, 'ends_on' => $text])
            ->assertUnprocessable()->assertJsonPath('error.details.starts_on', ['date_format']);
        $this->asAdmin('PATCH', '/api/staff/terms/'.rawurlencode($text), ['name' => 'X', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18'])
            ->assertNotFound();

        $this->assertSame(0, AcademicTerm::query()->count());
    }
}
