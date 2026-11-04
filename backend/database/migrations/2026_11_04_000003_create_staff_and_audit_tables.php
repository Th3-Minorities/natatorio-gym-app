<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Personal accounts for Staff and Administrators, and the audit log of their changes
 * (docs/design/data-model.md, sections 2, 4 and 5; decision D13).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Never deleted: deactivated_at ends access and keeps audit entries pointing at the person.
        Schema::create('staff_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('shown in the audit log');
            $table->string('email');
            $table->string('password')->comment('hash');
            $table->string('role', 10)->comment('staff or admin');
            $table->string('locale', 2)->default('es');
            $table->timestampTz('deactivated_at')->nullable()->comment('NULL while access is allowed');
            $table->timestampsTz();
        });

        // One account per email, whatever the case. Separate from users, so a User may share it (D13).
        DB::statement('CREATE UNIQUE INDEX staff_accounts_email_lower_unique ON staff_accounts (lower(email))');
        DB::statement("ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_role_check CHECK (role IN ('staff', 'admin'))");
        DB::statement("ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_locale_check CHECK (locale IN ('es', 'en'))");

        Schema::create('audit_log_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_account_id')->nullable()->constrained()->restrictOnDelete()
                ->comment('who made the change, NULL for system alerts');
            $table->timestampTz('occurred_at');
            $table->ipAddress('ip_address')->nullable()->comment('real client IP from the proxy header');
            $table->text('user_agent')->nullable()->comment('device and browser');
            $table->string('action', 50);
            // The affected record, with no foreign key: deleting it never removes the entry (REQ-NF-39).
            $table->string('subject_table', 50)->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->jsonb('before_values')->nullable();
            $table->jsonb('after_values')->nullable();
            $table->text('reason')->nullable()->comment('manual grant, revoke or reinstate');
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_log_entries');
        Schema::dropIfExists('staff_accounts');
    }
};
