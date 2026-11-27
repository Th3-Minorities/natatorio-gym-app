<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Keep orders and current photos when the sync or removed roster row reaches its keep period.
        // Withdrawal leaves past-term athlete authorizations active, so any status may lose its roster row.
        Schema::table('imported_memberships', function (Blueprint $table) {
            $table->unsignedBigInteger('import_id')->nullable()->comment('import that created the row')->change();
        });
        DB::statement('ALTER TABLE authorizations DROP CONSTRAINT authorizations_source_check');
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_source_check CHECK (
            (type = 'paid' AND imported_membership_id IS NOT NULL AND roster_record_id IS NULL)
            OR (type = 'athlete' AND imported_membership_id IS NULL)
            OR (type = 'manual' AND imported_membership_id IS NULL AND roster_record_id IS NULL))");
    }

    public function down(): void
    {
        // Removed provenance cannot be reconstructed. Refuse rollback before making any schema change.
        if (DB::table('imported_memberships')->whereNull('import_id')->exists()
            || DB::table('authorizations')->where('type', 'athlete')->whereNull('roster_record_id')->exists()) {
            throw new RuntimeException('Cannot restore required references after retention has removed their source records.');
        }

        DB::statement('ALTER TABLE authorizations DROP CONSTRAINT authorizations_source_check');
        DB::statement("ALTER TABLE authorizations ADD CONSTRAINT authorizations_source_check CHECK (
            (type = 'paid' AND imported_membership_id IS NOT NULL AND roster_record_id IS NULL)
            OR (type = 'athlete' AND roster_record_id IS NOT NULL AND imported_membership_id IS NULL)
            OR (type = 'manual' AND imported_membership_id IS NULL AND roster_record_id IS NULL))");
        Schema::table('imported_memberships', function (Blueprint $table) {
            $table->unsignedBigInteger('import_id')->nullable(false)->comment('import that created the row')->change();
        });
    }
};
