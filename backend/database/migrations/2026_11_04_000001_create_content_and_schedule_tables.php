<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Settings, notices, facility information and the schedule (docs/design/data-model.md, sections 4 and 5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('settings', function (Blueprint $table) {
            $table->string('name', 50)->primary();
            $table->text('value');
            $table->timestampsTz();
        });

        Schema::create('notices', function (Blueprint $table) {
            $table->id();
            $table->text('text_es');
            $table->text('text_en')->nullable()->comment('NULL shows the Spanish text');
            $table->timestampTz('shown_from');
            $table->timestampTz('shown_until')->nullable()->comment('NULL means no end');
            $table->timestampsTz();
        });

        Schema::create('facility_information', function (Blueprint $table) {
            $table->id();
            $table->string('topic', 30);
            $table->text('text_es');
            $table->text('text_en')->nullable()->comment('NULL shows the Spanish text');
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE facility_information ADD CONSTRAINT facility_information_topic_check
            CHECK (topic IN ('rules', 'towel', 'footwear', 'machines', 'equipment'))");

        // One table for weekly and dated slots (decision D8).
        Schema::create('schedule_slots', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);
            $table->smallInteger('weekday')->nullable()->comment('weekly slots only');
            $table->time('start_time')->nullable()->comment('weekly slots only');
            $table->time('end_time')->nullable()->comment('weekly slots only');
            $table->timestampTz('starts_at')->nullable()->comment('dated slots only');
            $table->timestampTz('ends_at')->nullable()->comment('dated slots only');
            $table->text('text_es')->nullable();
            $table->text('text_en')->nullable()->comment('NULL shows the Spanish text');
            $table->timestampsTz();
        });

        DB::statement("ALTER TABLE schedule_slots ADD CONSTRAINT schedule_slots_type_check
            CHECK (type IN ('regular_hours', 'special_hours', 'closure', 'athletes_only'))");

        DB::statement('ALTER TABLE schedule_slots ADD CONSTRAINT schedule_slots_weekly_or_dated_check CHECK (
            (weekday IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL AND starts_at IS NULL AND ends_at IS NULL)
            OR (weekday IS NULL AND start_time IS NULL AND end_time IS NULL AND starts_at IS NOT NULL AND ends_at IS NOT NULL)
        )');

        DB::statement("ALTER TABLE schedule_slots ADD CONSTRAINT schedule_slots_dated_types_check
            CHECK (type NOT IN ('special_hours', 'closure') OR starts_at IS NOT NULL)");
    }

    public function down(): void
    {
        Schema::dropIfExists('schedule_slots');
        Schema::dropIfExists('facility_information');
        Schema::dropIfExists('notices');
        Schema::dropIfExists('settings');
    }
};
