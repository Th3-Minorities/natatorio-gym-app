<?php

namespace Tests\Feature\Roster;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use Illuminate\Database\Events\TransactionRolledBack;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** Withdraw an athlete from the roster and reinstate one withdrawn by mistake (REQ-F-49, E-93, E-95, A-05, #21). */
class RosterWithdrawTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private const REASON = 'Lo retiré por error, sigue en el equipo.';

    private StaffAccount $admin;

    private AcademicTerm $term;

    private RosterRecord $athlete;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-08 10:00:00');
        $this->admin = StaffAccount::factory()->admin()->create();
        $this->term = AcademicTerm::query()->create(['name' => 'Agosto - diciembre 2026', 'starts_on' => '2026-08-10', 'ends_on' => '2026-12-18']);
        $this->athlete = RosterRecord::factory()->create(['name' => 'Alina Mercado Cruz']);
    }

    private function asAdmin(string $method, string $uri, array $data = []): TestResponse
    {
        return $this->actingAs($this->admin, 'staff')->fromThePwa()->json($method, $uri, $data);
    }

    private function claim(?AcademicTerm $term = null, string $status = 'active'): Authorization
    {
        return Authorization::factory()->athlete($this->athlete)->create([
            'academic_term_id' => ($term ?? $this->term)->id, 'status' => $status,
        ]);
    }

    private function withdraw(): TestResponse
    {
        return $this->asAdmin('POST', "/api/staff/roster/{$this->athlete->id}/withdraw");
    }

    private function reinstate(string $reason = self::REASON): TestResponse
    {
        return $this->asAdmin('POST', "/api/staff/roster/{$this->athlete->id}/reinstate", ['reason' => $reason]);
    }

    // Withdraw

    public function test_withdrawing_revokes_the_current_authorization_and_logs_it(): void
    {
        $authorization = $this->claim();

        $this->withdraw()->assertOk()->assertJsonPath('athlete.status', 'withdrawn');

        $this->assertNotNull($this->athlete->fresh()->removed_at);
        $this->assertSame('revoked', $authorization->fresh()->status);
        $this->assertSame('removed from roster', $authorization->fresh()->reason);
        $this->assertNull($authorization->user->currentAuthorization());
        $entry = AuditLogEntry::query()->where('action', 'roster.withdraw')->sole();
        // The entry lists the authorizations the withdrawal revoked, past terms left out.
        $this->assertSame(['status' => 'active', 'authorizations' => [$authorization->id => 'active']], $entry->before_values);
        $this->assertSame(['status' => 'withdrawn', 'authorizations' => [$authorization->id => 'revoked']], $entry->after_values);
        $this->assertSame($this->athlete->id, $entry->subject_id);
    }

    /** REQ-F-49: the athlete keeps counting in occupancy until the current visit ends. */
    public function test_withdrawing_leaves_the_open_visit_open(): void
    {
        $authorization = $this->claim();
        $session = FacilitySession::factory()->create(['user_id' => $authorization->user_id, 'authorization_id' => $authorization->id]);

        $this->withdraw()->assertOk();

        $this->assertSame('active', $session->fresh()->status);
        $this->assertNull($session->fresh()->ended_at);
    }

    public function test_withdrawing_an_athlete_with_no_authorization_works(): void
    {
        $this->withdraw()->assertOk();

        $this->assertNotNull($this->athlete->fresh()->removed_at);
    }

    /** A past term's authorization is history: it stays as it was. */
    public function test_withdrawing_leaves_past_terms_alone(): void
    {
        $spring = AcademicTerm::query()->create(['name' => 'Enero - mayo 2026', 'starts_on' => '2026-01-12', 'ends_on' => '2026-05-15']);
        $old = $this->claim($spring);

        $this->withdraw()->assertOk();

        $this->assertSame('active', $old->fresh()->status);
        $this->assertNull($old->fresh()->reason);
    }

    public function test_withdrawing_twice_is_refused(): void
    {
        $this->withdraw()->assertOk();

        $this->withdraw()->assertConflict()->assertJsonPath('error.code', 'roster_status_changed');
        $this->assertSame(1, AuditLogEntry::query()->where('action', 'roster.withdraw')->count());
    }

    // Reinstate

    public function test_reinstating_makes_the_revoked_authorization_active_again_and_logs_the_reason(): void
    {
        $authorization = $this->claim();
        $this->withdraw();

        $this->reinstate()->assertOk()->assertJsonPath('athlete.status', 'active');

        $this->assertNull($this->athlete->fresh()->removed_at);
        $this->assertSame('active', $authorization->fresh()->status);
        $this->assertNull($authorization->fresh()->reason);
        $this->assertTrue($authorization->user->currentAuthorization()->is($authorization));
        $entry = AuditLogEntry::query()->where('action', 'roster.reinstate')->sole();
        $this->assertSame(['status' => 'withdrawn', 'authorizations' => [$authorization->id => 'revoked']], $entry->before_values);
        $this->assertSame(['status' => 'active', 'authorizations' => [$authorization->id => 'active']], $entry->after_values);
        $this->assertSame(self::REASON, $entry->reason);
    }

    /** Only the authorization the withdrawal revoked comes back, not one revoked for another reason. */
    public function test_reinstating_leaves_other_revocations_alone(): void
    {
        $authorization = $this->claim(status: 'revoked');
        $authorization->forceFill(['reason' => 'order refunded'])->save();
        $this->athlete->forceFill(['removed_at' => now()])->save();

        $this->reinstate()->assertOk();

        $this->assertSame('revoked', $authorization->fresh()->status);
    }

    public function test_the_reason_needs_ten_characters(): void
    {
        $this->withdraw();

        $this->reinstate('error')->assertUnprocessable()->assertJsonPath('error.details.reason', ['min']);
        $this->reinstate('     error      ')->assertJsonPath('error.details.reason', ['min']);
        $this->asAdmin('POST', "/api/staff/roster/{$this->athlete->id}/reinstate")->assertJsonPath('error.details.reason', ['required']);
        $this->assertNotNull($this->athlete->fresh()->removed_at);
    }

    /** E-95: one active authorization per User and term. A-05 "Restitución rechazada" names the term. */
    public function test_reinstating_is_refused_when_the_person_already_has_an_active_authorization(): void
    {
        $authorization = $this->claim();
        $this->withdraw();
        Authorization::factory()->manual()->create(['user_id' => $authorization->user_id, 'academic_term_id' => $this->term->id]);

        $this->reinstate()->assertConflict()->assertExactJson(['error' => [
            'code' => 'roster_reinstate_active_authorization',
            'details' => ['term' => ['name' => 'Agosto - diciembre 2026']],
        ]]);
        $this->assertNotNull($this->athlete->fresh()->removed_at);
        $this->assertSame('revoked', $authorization->fresh()->status);
        $this->assertSame(0, AuditLogEntry::query()->where('action', 'roster.reinstate')->count());
    }

    /**
     * Another active authorization appears at the same moment: the unique index stops the update. The answer keeps
     * the term in its details, as the check before the update does. The rival is inserted when the failed update
     * rolls back, because that is when a save that won the race would already be committed.
     */
    public function test_a_race_for_the_active_authorization_still_names_the_term(): void
    {
        $authorization = $this->claim();
        $this->withdraw();
        $armed = true;
        Authorization::updating(function (Authorization $changing) use (&$armed, $authorization) {
            if ($armed && $changing->is($authorization)) {
                $armed = false;
                Authorization::factory()->manual()->create(['user_id' => $authorization->user_id, 'academic_term_id' => $this->term->id]);
            }
        });
        Event::listen(TransactionRolledBack::class, function () use (&$armed, $authorization) {
            if (! $armed && ! Authorization::query()->where('user_id', $authorization->user_id)->where('status', 'active')->exists()) {
                Authorization::factory()->manual()->create(['user_id' => $authorization->user_id, 'academic_term_id' => $this->term->id]);
            }
        });

        $this->reinstate()->assertConflict()->assertExactJson(['error' => [
            'code' => 'roster_reinstate_active_authorization',
            'details' => ['term' => ['name' => 'Agosto - diciembre 2026']],
        ]]);
        $this->assertNotNull($this->athlete->fresh()->removed_at);
        $this->assertSame(0, AuditLogEntry::query()->where('action', 'roster.reinstate')->count());
    }

    public function test_reinstating_an_active_athlete_is_refused(): void
    {
        $this->reinstate()->assertConflict()->assertJsonPath('error.code', 'roster_status_changed');
    }

    // Who may call it

    public function test_staff_cannot_withdraw_or_reinstate(): void
    {
        $staff = StaffAccount::factory()->create();

        foreach (['withdraw', 'reinstate'] as $action) {
            $this->actingAs($staff, 'staff')->fromThePwa()
                ->postJson("/api/staff/roster/{$this->athlete->id}/{$action}", ['reason' => self::REASON])
                ->assertForbidden()->assertJsonPath('error.code', 'forbidden');
        }
        $this->assertNull($this->athlete->fresh()->removed_at);
    }

    public function test_an_unknown_athlete_is_not_found(): void
    {
        $this->asAdmin('POST', '/api/staff/roster/999/withdraw')->assertNotFound();
        $this->asAdmin('POST', '/api/staff/roster/999/reinstate', ['reason' => self::REASON])->assertNotFound();
    }

    // Injection (#21 "Done when")

    /** @return array<string, array{string}> */
    public static function injections(): array
    {
        return ['SQL' => ["' OR '1'='1 -- more text"], 'script' => ['<script>alert(1)</script>']];
    }

    #[DataProvider('injections')]
    public function test_injection_in_the_reason_is_kept_as_plain_text_and_in_the_id_is_refused(string $text): void
    {
        $this->withdraw();

        $this->asAdmin('POST', '/api/staff/roster/'.rawurlencode($text).'/reinstate', ['reason' => self::REASON])->assertNotFound();
        $this->reinstate($text)->assertOk();
        $this->assertSame($text, AuditLogEntry::query()->where('action', 'roster.reinstate')->sole()->reason);
    }
}
