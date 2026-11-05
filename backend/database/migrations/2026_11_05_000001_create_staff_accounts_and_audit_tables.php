<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Staff accounts and the audit log (docs/design/data-model.md, sections 2, 4 and 5).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Separate from users (D13). Never deleted, only deactivated, so the audit log keeps its people.
        Schema::create('staff_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('shown in the audit log');
            $table->string('email');
            $table->string('password')->comment('hash');
            $table->string('role', 10)->comment('staff or admin');
            $table->string('locale', 2)->comment('es or en, changed in the account preferences (D11)');
            $table->timestampTz('deactivated_at')->nullable()->comment('NULL while access is allowed, set when the person leaves');
            $table->timestampsTz();
        });

        // The same email may also have a User account, so this index does not look at users (D13).
        DB::statement('CREATE UNIQUE INDEX staff_accounts_email_unique ON staff_accounts (lower(email))');
        DB::statement("ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_role_check CHECK (role IN ('staff', 'admin'))");
        DB::statement("ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_locale_check CHECK (locale IN ('es', 'en'))");

        // Nobody edits or deletes an entry through the app (E-108). The affected record has no foreign key,
        // so deleting a User or undoing an import never touches an entry.
        Schema::create('audit_log_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_account_id')->nullable()->constrained()->restrictOnDelete()->comment('who made the change, NULL for system alerts');
            $table->timestampTz('occurred_at')->useCurrent();
            $table->ipAddress('ip_address')->nullable()->comment('real client IP from the proxy header, NULL for system alerts');
            $table->text('user_agent')->nullable()->comment('device and browser, NULL for system alerts');
            $table->string('action', 50);
            $table->string('subject_table', 50)->nullable()->comment('affected record, no FK');
            $table->unsignedBigInteger('subject_id')->nullable()->comment('affected record, no FK');
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
