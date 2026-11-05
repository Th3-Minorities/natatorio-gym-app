<?php

namespace Tests\Feature\Database;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\Import;
use App\Models\ImportedMembership;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\AssertsDatabaseRules;
use Tests\TestCase;

/** Rules for roster_records, email_links, waiver_acceptances and authorizations (data-model.md sections 5 and 6). */
class RosterLinksAndAuthorizationsTablesTest extends TestCase
{
    use AssertsDatabaseRules, RefreshDatabase;

    public function test_a_student_number_appears_once_in_the_roster(): void
    {
        RosterRecord::factory()->create(['student_number' => '802-11-1111']);

        $this->assertRejected('23505', fn () => RosterRecord::factory()->create(['student_number' => '802-11-1111']));
    }

    public function test_every_roster_record_has_a_sport(): void
    {
        $this->assertRejected('23502', fn () => RosterRecord::factory()->create(['sport' => null]));
    }

    public function test_a_removed_roster_record_keeps_its_row(): void
    {
        $this->assertNull(RosterRecord::factory()->create()->removed_at);
        $this->assertNotNull(RosterRecord::factory()->removed()->create()->removed_at);
    }

    public function test_an_athlete_registration_link_is_for_a_roster_record_and_no_user(): void
    {
        EmailLink::factory()->athleteRegistration()->create();

        $this->assertRejected('23514', fn () => EmailLink::factory()->athleteRegistration()->create(['user_id' => User::factory()->create()->id]));
        $this->assertRejected('23514', fn () => EmailLink::factory()->athleteRegistration()->create(['roster_record_id' => null]));
    }

    public function test_an_athlete_link_belongs_to_a_roster_record_and_a_signed_in_user(): void
    {
        EmailLink::factory()->athleteLink()->create();

        $this->assertRejected('23514', fn () => EmailLink::factory()->athleteLink()->create(['user_id' => null]));
        $this->assertRejected('23514', fn () => EmailLink::factory()->athleteLink()->create(['roster_record_id' => null]));
    }

    public function test_a_staff_invite_belongs_to_a_staff_account_only(): void
    {
        EmailLink::factory()->staffInvite()->create();

        $this->assertRejected('23514', fn () => EmailLink::factory()->staffInvite()->create(['staff_account_id' => null]));
        $this->assertRejected('23514', fn () => EmailLink::factory()->staffInvite()->create(['roster_record_id' => RosterRecord::factory()->create()->id]));
        $this->assertRejected('23514', fn () => EmailLink::factory()->staffInvite()->create(['user_id' => User::factory()->create()->id]));
    }

    public function test_an_athlete_link_cannot_name_a_staff_account(): void
    {
        $this->assertRejected('23514', fn () => EmailLink::factory()->athleteLink()->create(['staff_account_id' => StaffAccount::factory()->create()->id]));
    }

    public function test_an_emailed_link_has_one_of_the_three_purposes(): void
    {
        $this->assertRejected('23514', fn () => EmailLink::factory()->athleteLink()->create(['purpose' => 'password_reset']));
    }

    public function test_a_link_is_found_only_by_its_hash(): void
    {
        EmailLink::factory()->athleteRegistration()->create(['token_hash' => str_repeat('a', 64)]);

        $this->assertRejected('23505', fn () => EmailLink::factory()->athleteRegistration()->create(['token_hash' => str_repeat('a', 64)]));
    }

    public function test_a_link_for_a_deleted_roster_record_goes_with_it(): void
    {
        $link = EmailLink::factory()->athleteLink()->create();

        DB::table('roster_records')->where('id', $link->roster_record_id)->delete();

        $this->assertSame(0, EmailLink::query()->count());
    }

    public function test_a_users_links_go_with_the_user(): void
    {
        $link = EmailLink::factory()->athleteLink()->create();

        DB::table('users')->where('id', $link->user_id)->delete();

        $this->assertSame(0, EmailLink::query()->count());
    }

    public function test_a_staff_invite_goes_with_its_staff_account(): void
    {
        $link = EmailLink::factory()->staffInvite()->create();

        DB::table('staff_accounts')->where('id', $link->staff_account_id)->delete();

        $this->assertSame(0, EmailLink::query()->count());
    }

    public function test_a_user_accepts_the_waiver_once_and_it_records_the_version(): void
    {
        $waiver = WaiverAcceptance::factory()->create();

        $this->assertNotEmpty($waiver->fresh()->waiver_version);
        $this->assertRejected('23505', fn () => WaiverAcceptance::factory()->create(['user_id' => $waiver->user_id]));
        $this->assertRejected('23502', fn () => WaiverAcceptance::factory()->create(['waiver_version' => null]));
    }

    public function test_a_waiver_goes_with_the_user_row(): void
    {
        $waiver = WaiverAcceptance::factory()->create();

        DB::table('users')->where('id', $waiver->user_id)->delete();

        $this->assertSame(0, WaiverAcceptance::query()->count());
    }

    public function test_an_authorization_number_is_claimed_by_one_authorization_at_most(): void
    {
        $membership = ImportedMembership::factory()->create();
        Authorization::factory()->paid($membership)->create();

        $this->assertRejected('23505', fn () => Authorization::factory()->paid($membership)->create());
    }

    public function test_a_roster_record_is_claimed_once_per_term(): void
    {
        $record = RosterRecord::factory()->create();
        $fall = AcademicTerm::factory()->create();
        $spring = AcademicTerm::factory()->create();
        Authorization::factory()->athlete($record)->create(['academic_term_id' => $fall->id]);

        $this->assertRejected('23505', fn () => Authorization::factory()->athlete($record)->create(['academic_term_id' => $fall->id, 'status' => 'revoked']));

        Authorization::factory()->athlete($record)->create(['academic_term_id' => $spring->id]);
        $this->assertSame(2, Authorization::query()->count());
    }

    public function test_authorizations_without_a_roster_record_do_not_collide_with_each_other(): void
    {
        $term = AcademicTerm::factory()->create();

        Authorization::factory()->count(2)->manual()->create(['academic_term_id' => $term->id, 'status' => 'revoked']);
        Authorization::factory()->paid()->create(['academic_term_id' => $term->id]);

        $this->assertSame(3, Authorization::query()->count());
    }

    public function test_a_user_has_one_active_authorization_per_term(): void
    {
        $user = User::factory()->create();
        $term = AcademicTerm::factory()->create();
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);

        $this->assertRejected('23505', fn () => Authorization::factory()->paid()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]));
    }

    public function test_a_revoked_authorization_does_not_block_a_new_one_in_the_same_term(): void
    {
        $user = User::factory()->create();
        $term = AcademicTerm::factory()->create();
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id, 'status' => 'revoked']);
        Authorization::factory()->paid()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);

        $this->assertSame(2, Authorization::query()->count());
    }

    public function test_a_user_may_hold_an_active_authorization_in_each_term(): void
    {
        $user = User::factory()->create();
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => AcademicTerm::factory()->create()->id]);
        Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => AcademicTerm::factory()->create()->id]);

        $this->assertSame(2, Authorization::query()->count());
    }

    public function test_reinstating_a_revoked_authorization_is_refused_when_another_is_active(): void
    {
        $user = User::factory()->create();
        $term = AcademicTerm::factory()->create();
        $revoked = Authorization::factory()->manual()->create(['user_id' => $user->id, 'academic_term_id' => $term->id, 'status' => 'revoked']);
        Authorization::factory()->paid()->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);

        $this->assertRejected('23505', fn () => $revoked->update(['status' => 'active']));
    }

    public function test_an_authorization_has_the_source_its_type_says(): void
    {
        $membership = ImportedMembership::factory()->create();
        $record = RosterRecord::factory()->create();

        $this->assertRejected('23514', fn () => Authorization::factory()->paid()->create(['imported_membership_id' => null]));
        $this->assertRejected('23514', fn () => Authorization::factory()->paid($membership)->create(['roster_record_id' => $record->id]));
        $this->assertRejected('23514', fn () => Authorization::factory()->athlete()->create(['roster_record_id' => null]));
        $this->assertRejected('23514', fn () => Authorization::factory()->athlete($record)->create(['imported_membership_id' => $membership->id]));
        $this->assertRejected('23514', fn () => Authorization::factory()->manual()->create(['imported_membership_id' => $membership->id]));
        $this->assertRejected('23514', fn () => Authorization::factory()->manual()->create(['roster_record_id' => $record->id]));
    }

    public function test_an_authorization_type_and_status_are_from_the_lists(): void
    {
        $this->assertRejected('23514', fn () => Authorization::factory()->manual()->create(['type' => 'gift']));
        $this->assertRejected('23514', fn () => Authorization::factory()->manual()->create(['status' => 'pending']));
    }

    public function test_a_manual_grant_has_a_reason(): void
    {
        $this->assertRejected('23514', fn () => Authorization::factory()->manual()->create(['reason' => null]));
    }

    public function test_a_paid_authorization_needs_no_reason(): void
    {
        $this->assertNull(Authorization::factory()->paid()->create()->reason);
    }

    public function test_an_authorization_photo_may_be_missing_and_may_be_marked_pending(): void
    {
        $authorization = Authorization::factory()->manual()->create(['photo_path' => null, 'photo_pending_at' => now()]);

        $this->assertNull($authorization->fresh()->photo_path);
        $this->assertNotNull($authorization->fresh()->photo_pending_at);
    }

    public function test_deleting_an_order_deletes_its_authorization(): void
    {
        $authorization = Authorization::factory()->paid()->create();
        Authorization::factory()->manual()->create();

        DB::table('imported_memberships')->where('id', $authorization->imported_membership_id)->delete();

        $this->assertSame(1, Authorization::query()->count());
        $this->assertSame('manual', Authorization::query()->value('type'));
    }

    public function test_a_roster_record_with_an_authorization_cannot_be_deleted(): void
    {
        $authorization = Authorization::factory()->athlete()->create();

        $this->assertRejected('23503', fn () => DB::table('roster_records')->where('id', $authorization->roster_record_id)->delete());
    }

    public function test_a_term_with_authorizations_cannot_be_deleted(): void
    {
        $authorization = Authorization::factory()->manual()->create();

        $this->assertRejected('23503', fn () => DB::table('academic_terms')->where('id', $authorization->academic_term_id)->delete());
    }

    public function test_deleting_a_user_row_deletes_its_authorizations(): void
    {
        $authorization = Authorization::factory()->manual()->create();

        DB::table('users')->where('id', $authorization->user_id)->delete();

        $this->assertSame(0, Authorization::query()->count());
    }

    public function test_the_factories_make_valid_rows(): void
    {
        Authorization::factory()->paid()->create();
        Authorization::factory()->athlete()->create();
        Authorization::factory()->manual()->create();
        Import::factory()->create();

        $this->assertSame(3, Authorization::query()->count());
    }
}
