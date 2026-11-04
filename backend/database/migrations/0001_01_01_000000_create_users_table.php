<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * User accounts, password resets and sign-in sessions, shaped to the data model
 * (docs/design/data-model.md section 2; api-conventions.md section 3).
 */
return new class extends Migration
{
    public function up(): void
    {
        // No name (it comes from the waiver, D7) and no email verification. A deleted account keeps
        // its row with every personal column NULL and deleted_at set (decision D2).
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->nullable()->comment('NULL after deletion');
            $table->string('password')->nullable()->comment('hash, NULL after deletion');
            $table->string('locale', 2)->default('es');
            $table->string('current_session_id')->nullable()->comment('the one session allowed in (D3)');
            $table->timestampTz('deleted_at')->nullable()->comment('set when the account is deleted');
            $table->timestampsTz();
        });

        // One account per email, whatever the case. NULL emails of deleted accounts never collide.
        DB::statement('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email))');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_locale_check CHECK (locale IN ('es', 'en'))");

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestampTz('created_at')->nullable();
        });

        // Laravel's session table, renamed so it is never confused with facility_sessions.
        // IP and user agent stay NULL (decision D4); staff sessions have user_id NULL (D13).
        Schema::create('sign_in_sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sign_in_sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
