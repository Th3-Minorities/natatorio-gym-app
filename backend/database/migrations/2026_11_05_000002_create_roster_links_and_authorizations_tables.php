<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The roster, emailed links, waivers and authorizations (docs/design/data-model.md, sections 2, 5 and 6).
 */
return new class extends Migration
{
    public function up(): void
    {
        // One roster, not one per term (D16). A removed athlete keeps the row and gets removed_at.
        Schema::create('roster_records', function (Blueprint $table) {
            $table->id();
            $table->string('student_number', 20)->unique();
            $table->string('name');
            $table->string('institutional_email')->comment('the gym adds it to the list');
            $table->string('sport', 50)->comment('from the coach\'s team list');
            $table->timestampTz('removed_at')->nullable()->comment('NULL while the athlete is on the roster (D16)');
            $table->timestampsTz();
        });

        // Only the hash of the token is stored (D9). Staff invitations use this table too.
        Schema::create('email_links', function (Blueprint $table) {
            $table->id();
            $table->string('purpose', 25)->comment('athlete_registration, athlete_link or staff_invite');
            $table->string('token_hash', 64)->unique()->comment('hash of the token in the link');
            $table->foreignId('roster_record_id')->nullable()->constrained()->cascadeOnDelete()->comment('record the link is for, NULL for staff_invite');
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete()->comment('signed-in User, only for athlete_link');
            $table->foreignId('staff_account_id')->nullable()->constrained()->cascadeOnDelete()->comment('invited staff account, only for staff_invite');
            $table->timestampTz('expires_at');
            $table->timestampTz('used_at')->nullable()->comment('NULL until opened, single use');
            $table->timestampsTz();
        });

        // Each purpose has exactly the owner columns it needs.
        DB::statement("ALTER TABLE email_links ADD CONSTRAINT email_links_owner_check CHECK (
            (purpose = 'athlete_registration' AND roster_record_id IS NOT NULL AND user_id IS NULL AND staff_account_id IS NULL)
            OR (purpose = 'athlete_link' AND roster_record_id IS NOT NULL AND user_id IS NOT NULL AND staff_account_id IS NULL)
            OR (purpose = 'staff_invite' AND roster_record_id IS NULL AND user_id IS NULL AND staff_account_id IS NOT NULL))");

        Schema::create('waiver_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('full_name')->comment('the display name on the Gym ID and in Staff search, set at registration (D7)');
            $table->string('email');
            $table->string('emergency_contact_name')->comment('the User can edit it');
            $table->string('emergency_contact_phone', 30)->comment('the User can edit it');
            $table->string('waiver_version', 20)->comment('which text the person accepted (E-134)');
            $table->timestampTz('accepted_at');
            $table->timestampsTz();
        });

        // One authorization per User and term and source. Expiry is not stored: it follows the term's ends_on.
        Schema::create('authorizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_term_id')->constrained()->restrictOnDelete();
            $table->string('type', 10)->comment('paid, athlete or manual');
            $table->string('status', 10)->comment('active or revoked, one active per User and term');
            // Deleting an order deletes its authorization.
            $table->foreignId('imported_membership_id')->nullable()->unique()->constrained()->cascadeOnDelete()->comment('paid only');
            // No cascade (E-93): removing an athlete sets removed_at and revokes the authorization. The record is deleted
            // 5 years after its removal, when its authorizations (deleted 5 years after they were created) are gone (E-145).
            $table->foreignId('roster_record_id')->nullable()->constrained()->restrictOnDelete()->comment('athlete only, unique with the term (D16)');
            $table->string('photo_path')->nullable()->comment('private volume, NULL until uploaded');
            $table->timestampTz('photo_pending_at')->nullable()->comment('set when Staff mark the photo as not matching (D17)');
            $table->boolean('created_account')->default(false)->comment('this claim created the account');
            $table->string('member_group', 10)->nullable()->comment('manual only: student or employee, picked by the Administrator (E-148)');
            $table->text('reason')->nullable()->comment('manual grant, "removed from roster", "order cancelled" or "order refunded"');
            $table->timestampsTz();

            // A roster record is claimed once per term (D16). Paid and manual rows have NULL and never collide.
            $table->unique(['roster_record_id', 'academic_term_id']);
        });

        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_type_check CHECK (type IN ('paid', 'athlete', 'manual'))");
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_status_check CHECK (status IN ('active', 'revoked'))");

        // An authorization has the source its type says (REQ-F-19, REQ-F-87).
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_source_check CHECK (
            (type = 'paid' AND imported_membership_id IS NOT NULL AND roster_record_id IS NULL)
            OR (type = 'athlete' AND roster_record_id IS NOT NULL AND imported_membership_id IS NULL)
            OR (type = 'manual' AND imported_membership_id IS NULL AND roster_record_id IS NULL))");

        // The backend checks the 10 characters and writes the reason to the audit log (E-86).
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_member_group_check CHECK (member_group IN ('student', 'employee'))");
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_manual_member_group_check CHECK ((type = 'manual') = (member_group IS NOT NULL))");
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_manual_reason_check CHECK (type <> 'manual' OR reason IS NOT NULL)");

        // Only active authorizations count (E-68, E-94): a revoked one does not block a new grant or claim.
        DB::statement("CREATE UNIQUE INDEX authorizations_one_active_per_user_and_term ON authorizations (user_id, academic_term_id) WHERE (status = 'active')");
    }

    public function down(): void
    {
        Schema::dropIfExists('authorizations');
        Schema::dropIfExists('waiver_acceptances');
        Schema::dropIfExists('email_links');
        Schema::dropIfExists('roster_records');
    }
};
