<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The athlete roster, waivers, emailed links and authorizations
 * (docs/design/data-model.md, sections 2, 5 and 6).
 */
return new class extends Migration
{
    public function up(): void
    {
        // The department's list. A record is claimed when an authorization points at it.
        Schema::create('roster_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('academic_term_id')->constrained()->restrictOnDelete();
            $table->string('student_number', 20);
            $table->string('name');
            $table->string('institutional_email')->comment('the athlete link is sent here');
            $table->string('sport', 50)->comment("from the coach's team list (#62 question 15)");
            $table->timestampsTz();

            $table->unique(['academic_term_id', 'student_number']);
        });

        Schema::create('waiver_acceptances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('full_name')->comment('the display name on the Gym ID and in Staff search (D7)');
            $table->string('email');
            $table->string('emergency_contact_name');
            $table->string('emergency_contact_phone', 30);
            $table->timestampTz('accepted_at');
            $table->timestampsTz();
        });

        // Only the hash of the token or code is stored. Single use, before expires_at (D9).
        Schema::create('email_links', function (Blueprint $table) {
            $table->id();
            $table->string('purpose', 25);
            $table->string('token_hash', 64)->unique();
            $table->foreignId('roster_record_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete()
                ->comment('signed-in User, NULL for registration');
            $table->timestampTz('expires_at');
            $table->timestampTz('used_at')->nullable()->comment('NULL until opened');
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE email_links ADD CONSTRAINT email_links_purpose_check
            CHECK (purpose IN ('athlete_registration', 'athlete_link', 'athlete_in_person'))");
        DB::statement("ALTER TABLE email_links ADD CONSTRAINT email_links_user_check
            CHECK ((purpose = 'athlete_link') = (user_id IS NOT NULL))");

        Schema::create('authorizations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('academic_term_id')->constrained()->restrictOnDelete();
            $table->string('type', 10)->comment('paid, athlete or manual');
            $table->string('status', 10)->default('active')->comment('active or revoked');
            // Undoing an import deletes the authorizations of its orders (REQ-F-31).
            $table->foreignId('imported_membership_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            // No cascade: removing an athlete revokes the authorization instead (E-93).
            $table->foreignId('roster_record_id')->nullable()->unique()->constrained()->restrictOnDelete();
            $table->string('photo_path')->nullable()->comment('private volume, NULL until uploaded');
            $table->boolean('created_account')->default(false)->comment('this claim created the account');
            $table->text('reason')->nullable()->comment("manual grant, or 'removed from roster'");
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_type_check
            CHECK (type IN ('paid', 'athlete', 'manual'))");
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_status_check
            CHECK (status IN ('active', 'revoked'))");
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_source_check CHECK (
            (type = 'paid' AND imported_membership_id IS NOT NULL AND roster_record_id IS NULL)
            OR (type = 'athlete' AND roster_record_id IS NOT NULL AND imported_membership_id IS NULL)
            OR (type = 'manual' AND imported_membership_id IS NULL AND roster_record_id IS NULL)
        )");
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_manual_reason_check
            CHECK (type <> 'manual' OR reason IS NOT NULL)");

        // One active authorization per User and term; a revoked one does not count (E-94).
        DB::statement("CREATE UNIQUE INDEX authorizations_one_active_per_term
            ON authorizations (user_id, academic_term_id) WHERE (status = 'active')");
    }

    public function down(): void
    {
        Schema::dropIfExists('authorizations');
        Schema::dropIfExists('email_links');
        Schema::dropIfExists('waiver_acceptances');
        Schema::dropIfExists('roster_records');
    }
};
