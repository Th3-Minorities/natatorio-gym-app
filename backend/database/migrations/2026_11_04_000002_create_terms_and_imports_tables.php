<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Academic terms and the WooCommerce imports (docs/design/data-model.md, sections 2, 5 and 6).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Terms are never deleted (E-107); a mistake is fixed by editing the dates.
        Schema::create('academic_terms', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50);
            $table->date('starts_on')->comment('America/Puerto_Rico date');
            $table->date('ends_on')->comment('America/Puerto_Rico date');
            $table->timestampsTz();
        });

        DB::statement('ALTER TABLE academic_terms ADD CONSTRAINT academic_terms_dates_check CHECK (starts_on <= ends_on)');

        // Terms never overlap; gaps are allowed (REQ-F-21). Date ranges need no extension.
        DB::statement("ALTER TABLE academic_terms ADD CONSTRAINT academic_terms_no_overlap
            EXCLUDE USING gist (daterange(starts_on, ends_on, '[]') WITH &&)");

        // One row per store sync (E-127). There is no undo.
        Schema::create('imports', function (Blueprint $table) {
            $table->id();
            $table->string('file_name');
            $table->integer('created_count')->default(0);
            $table->integer('updated_count')->default(0);
            $table->integer('rejected_count')->default(0);
            $table->jsonb('result')->comment('counts, plus the order reference and reason of each skipped order, no names or emails (E-149); shown again in A-07');
            $table->timestampsTz();
        });

        // A copy of each WooCommerce order. Claimed when an authorization points at it.
        Schema::create('imported_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_id')->constrained()->restrictOnDelete()->comment('import that created the row');
            $table->foreignId('academic_term_id')->constrained()->restrictOnDelete()->comment('term that contains paid_at');
            $table->string('order_reference', 100)->unique()->comment('the import upserts on it (REQ-F-30)');
            $table->string('authorization_number', 20)->unique()->comment('6 characters, may include letters, unique across all orders (D1, E-128)');
            $table->string('name');
            $table->string('email')->comment('payment email');
            $table->string('member_group', 10)->comment('student or employee, from the order (D15)');
            $table->text('membership_details')->nullable();
            $table->string('order_status', 30);
            $table->timestampTz('paid_at');
            $table->timestampTz('synced_at');
            $table->timestampsTz();

            // The Authorization Number is unique across all orders (decision D1, E-128).
        });

        // Employees pay like students and only differ in the statistics (D15).
        DB::statement("ALTER TABLE imported_memberships ADD CONSTRAINT imported_memberships_member_group_check
            CHECK (member_group IN ('student', 'employee'))");
    }

    public function down(): void
    {
        Schema::dropIfExists('imported_memberships');
        Schema::dropIfExists('imports');
        Schema::dropIfExists('academic_terms');
    }
};
