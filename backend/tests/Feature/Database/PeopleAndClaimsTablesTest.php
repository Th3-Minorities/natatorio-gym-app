<?php

namespace Tests\Feature\Database;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\ImportedMembership;
use App\Models\RosterRecord;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\AssertsDatabaseRules;
use Tests\TestCase;

/**
 * Rules for users, sign_in_sessions, roster_records, waiver_acceptances, email_links and
 * authorizations (data-model.md sections 2, 5 and 6).
 */
class PeopleAndClaimsTablesTest extends TestCase
{
    use AssertsDatabaseRules, RefreshDatabase;

    // Users

    public function test_one_account_per_email_ignoring_case(): void
    {
        DB::table('users')->insert(['email' => 'Ana@upr.edu', 'password' => 'x', 'locale' => 'es']);

        $this->assertRejected('23505', fn () => DB::table('users')->insert(['email' => 'ana@UPR.edu', 'password' => 'x', 'locale' => 'es']));
    }

    public function test_deleted_accounts_with_no_email_do_not_collide(): void
    {
        DB::table('users')->insert(['email' => null, 'password' => null, 'locale' => 'es', 'deleted_at' => '2026-11-01 10:00:00']);
        DB::table('users')->insert(['email' => null, 'password' => null, 'locale' => 'es', 'deleted_at' => '2026-11-02 10:00:00']);

        $this->assertSame(2, DB::table('users')->whereNull('email')->count());
    }

    public function test_user_language_is_spanish_or_english(): void
    {
        $this->assertRejected('23514', fn () => DB::table('users')->insert(['email' => 'a@upr.edu', 'locale' => 'fr']));
    }

    public function test_sessions_live_in_sign_in_sessions(): void
    {
        DB::table('sign_in_sessions')->insert(['id' => 'abc', 'user_id' => null, 'payload' => '', 'last_activity' => 0]);

        $this->assertSame('sign_in_sessions', config('session.table'));
        $this->assertSame(1, DB::table('sign_in_sessions')->count());
        $this->assertRejected('42P01', fn () => DB::table('sessions')->count());
    }

    // Roster records

    public function test_a_student_number_is_unique_within_a_term(): void
    {
        $term = AcademicTerm::factory()->create();
        DB::table('roster_records')->insert($this->rosterRow($term->id));

        $this->assertRejected('23505', fn () => DB::table('roster_records')->insert($this->rosterRow($term->id, ['name' => 'Other'])));
    }

    public function test_every_roster_record_has_a_sport(): void
    {
        $term = AcademicTerm::factory()->create();

        $this->assertRejected('23502', fn () => DB::table('roster_records')->insert($this->rosterRow($term->id, ['sport' => null])));
    }

    // Waivers

    public function test_one_waiver_per_account(): void
    {
        $waiver = WaiverAcceptance::factory()->create();

        $this->assertRejected('23505', fn () => WaiverAcceptance::factory()->create(['user_id' => $waiver->user_id]));
    }

    // Emailed links

    public function test_a_link_hash_is_unique(): void
    {
        $link = EmailLink::factory()->create();

        $this->assertRejected('23505', fn () => EmailLink::factory()->create(['token_hash' => $link->token_hash]));
    }

    public function test_link_purpose_must_be_known(): void
    {
        $this->assertRejected('23514', fn () => EmailLink::factory()->create(['purpose' => 'staff_invitation']));
    }

    public function test_only_athlete_link_has_a_user(): void
    {
        $user = User::factory()->create();

        $this->assertRejected('23514', fn () => EmailLink::factory()->create(['purpose' => 'athlete_link', 'user_id' => null]));
        $this->assertRejected('23514', fn () => EmailLink::factory()->create(['purpose' => 'athlete_registration', 'user_id' => $user->id]));
    }

    // Authorizations

    public function test_the_type_matches_its_source(): void
    {
        $membership = ImportedMembership::factory()->create();
        $roster = RosterRecord::factory()->create(['academic_term_id' => $membership->academic_term_id]);

        $this->assertRejected('23514', fn () => Authorization::factory()->create(['type' => 'paid', 'imported_membership_id' => null, 'roster_record_id' => null, 'academic_term_id' => $membership->academic_term_id]));
        $this->assertRejected('23514', fn () => Authorization::factory()->create(['type' => 'athlete', 'imported_membership_id' => $membership->id, 'roster_record_id' => null, 'academic_term_id' => $membership->academic_term_id]));
        $this->assertRejected('23514', fn () => Authorization::factory()->create(['type' => 'manual', 'imported_membership_id' => null, 'roster_record_id' => $roster->id, 'reason' => 'Error en la orden del socio', 'academic_term_id' => $membership->academic_term_id]));
    }

    public function test_type_and_status_values(): void
    {
        $this->assertRejected('23514', fn () => Authorization::factory()->manual()->create(['type' => 'guest']));
        $this->assertRejected('23514', fn () => Authorization::factory()->create(['status' => 'paused']));
    }

    public function test_a_manual_grant_needs_a_reason(): void
    {
        $this->assertRejected('23514', fn () => Authorization::factory()->manual()->create(['reason' => null]));
    }

    public function test_a_membership_is_claimed_once(): void
    {
        $first = Authorization::factory()->create();

        $this->assertRejected('23505', fn () => Authorization::factory()->create([
            'imported_membership_id' => $first->imported_membership_id,
            'academic_term_id' => $first->academic_term_id,
        ]));
    }

    public function test_a_roster_record_is_claimed_once(): void
    {
        $first = Authorization::factory()->athlete()->create();

        $this->assertRejected('23505', fn () => Authorization::factory()->athlete()->create([
            'roster_record_id' => $first->roster_record_id,
            'academic_term_id' => $first->academic_term_id,
        ]));
    }

    public function test_one_active_authorization_per_user_and_term(): void
    {
        $first = Authorization::factory()->create();

        $this->assertRejected('23505', fn () => Authorization::factory()->manual()->create([
            'user_id' => $first->user_id,
            'academic_term_id' => $first->academic_term_id,
        ]));
    }

    public function test_a_revoked_authorization_does_not_block_a_new_one(): void
    {
        $revoked = Authorization::factory()->create(['status' => 'revoked']);

        Authorization::factory()->manual()->create(['user_id' => $revoked->user_id, 'academic_term_id' => $revoked->academic_term_id]);

        $this->assertSame(2, DB::table('authorizations')->where('user_id', $revoked->user_id)->count());
    }

    public function test_undoing_an_import_deletes_its_authorizations(): void
    {
        $authorization = Authorization::factory()->create();

        DB::table('imported_memberships')->where('id', $authorization->imported_membership_id)->delete();

        $this->assertSame(0, DB::table('authorizations')->where('id', $authorization->id)->count());
    }

    public function test_a_claimed_roster_record_cannot_be_deleted(): void
    {
        $authorization = Authorization::factory()->athlete()->create();

        $this->assertRejected('23503', fn () => DB::table('roster_records')->where('id', $authorization->roster_record_id)->delete());
    }

    public function test_a_term_with_authorizations_cannot_be_deleted(): void
    {
        $authorization = Authorization::factory()->manual()->create();

        $this->assertRejected('23503', fn () => DB::table('academic_terms')->where('id', $authorization->academic_term_id)->delete());
    }

    public function test_the_factories_make_valid_rows(): void
    {
        User::factory()->count(2)->create();
        RosterRecord::factory()->count(2)->create();
        WaiverAcceptance::factory()->create();
        EmailLink::factory()->create();
        EmailLink::factory()->athleteLink()->create();
        Authorization::factory()->create();
        Authorization::factory()->athlete()->create();
        Authorization::factory()->manual()->create();

        $this->assertSame(3, DB::table('authorizations')->count());
        $this->assertSame(2, DB::table('email_links')->count());
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function rosterRow(int $termId, array $overrides = []): array
    {
        return [
            'academic_term_id' => $termId,
            'student_number' => '802123456',
            'name' => 'Ana Rivera',
            'institutional_email' => 'ana.rivera@upr.edu',
            'sport' => 'Voleibol',
            ...$overrides,
        ];
    }
}
