<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Facility sessions and the visit statistics (docs/design/data-model.md, sections 3, 5 and 6).
 */
return new class extends Migration
{
    public function up(): void
    {
        // The Docker init scripts turn it on in a fresh local database; the CTI database does not run them.
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');

        // Kept after the User or the authorization is gone, so Check In counts do not change (REQ-F-61).
        Schema::create('facility_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('authorization_id')->nullable()->constrained()->nullOnDelete()->comment('SET NULL if the authorization is deleted');
            $table->string('authorization_type', 10)->comment('copy at Check In: paid, athlete or manual');
            $table->string('member_group', 10)->nullable()->comment('copy at Check In for paid and manual: student or employee (D15, E-148)');
            $table->string('sport', 50)->nullable()->comment('copy at Check In for athletes, from the roster record (E-147)');
            // Both come from the database clock, because the Check In sends no time. Only a manual entry sends the paper time (D18).
            $table->timestampTz('started_at')->useCurrent()->comment('database now(), or the paper time for a manual entry');
            $table->timestampTz('ends_at')->default(DB::raw("now() + interval '2 hours'"))->comment('started_at plus 2 hours (D14)');
            $table->timestampTz('ended_at')->nullable()->comment('set on check-out, end early, closure or void');
            $table->string('status', 12)->comment('active, expired, checked_out, ended_early, closed or void');
            $table->boolean('assisted')->default(false)->comment('Staff-assisted Check In');
            $table->foreignId('entered_by_staff_account_id')->nullable()->constrained('staff_accounts')->restrictOnDelete()->comment('manual entry from the paper log only (D18)');
            $table->foreignId('checked_out_by_staff_account_id')->nullable()->constrained('staff_accounts')->restrictOnDelete()->comment('who marked the exit, NULL otherwise (E-129)');
            $table->timestampsTz();
        });

        // A session closes by itself 2 hours after the Check In; only a check-out may come later (D14).
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_two_hours_check CHECK (ends_at = started_at + interval '2 hours')");
        DB::statement('ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_ended_at_check CHECK (ended_at IS NULL OR ended_at >= started_at)');
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_ended_early_check CHECK (status <> 'ended_early' OR ended_at <= ends_at)");

        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_status_check
            CHECK (status IN ('active', 'expired', 'checked_out', 'ended_early', 'closed', 'void'))");
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_ended_at_status_check
            CHECK ((status IN ('checked_out', 'ended_early', 'closed', 'void')) = (ended_at IS NOT NULL))");

        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_authorization_type_check
            CHECK (authorization_type IN ('paid', 'athlete', 'manual'))");
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_member_group_check
            CHECK (member_group IN ('student', 'employee'))");
        // Paid and manual sessions count as student or employee members; athlete sessions count by sport (E-147, E-148).
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_member_group_source_check
            CHECK ((authorization_type IN ('paid', 'manual')) = (member_group IS NOT NULL))");
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_athlete_sport_check
            CHECK ((authorization_type = 'athlete') = (sport IS NOT NULL))");

        // A manual entry from the paper log is a finished visit (D18); a wrong one is voided, not deleted (E-146).
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_manual_entry_check
            CHECK (entered_by_staff_account_id IS NULL OR status IN ('checked_out', 'void'))");

        // One active session per User, also under simultaneous requests. The range stops at ends_at, so an expired
        // session stops blocking by itself and a late check-out never blocks a newer Check In. now() is not
        // allowed in a constraint, and the range avoids needing it.
        DB::statement("ALTER TABLE facility_sessions ADD CONSTRAINT facility_sessions_one_active_per_user
            EXCLUDE USING gist (user_id WITH =, tstzrange(started_at, LEAST(COALESCE(ended_at, ends_at), ends_at), '[)') WITH &&)
            WHERE (status <> 'void')");

        // People without an account, counted from the paper log for a time block. No names (E-132).
        Schema::create('manual_visit_counts', function (Blueprint $table) {
            $table->id();
            $table->timestampTz('starts_at')->comment('start of the time block from the paper log');
            $table->timestampTz('ends_at');
            $table->integer('visits')->comment('people without an account, no names (E-132)');
            $table->foreignId('entered_by_staff_account_id')->constrained('staff_accounts')->restrictOnDelete();
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE manual_visit_counts ADD CONSTRAINT manual_visit_counts_visits_check CHECK (visits > 0)');
        DB::statement('ALTER TABLE manual_visit_counts ADD CONSTRAINT manual_visit_counts_time_block_check CHECK (ends_at > starts_at)');

        // Counts only, no personal data, never deleted (D20, E-133).
        Schema::create('daily_visit_totals', function (Blueprint $table) {
            $table->date('day')->primary()->comment('America/Puerto_Rico date');
            $table->jsonb('totals')->comment('visits by group and sport, manual entries, busiest hour');
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_visit_totals');
        Schema::dropIfExists('manual_visit_counts');
        Schema::dropIfExists('facility_sessions');
    }
};
