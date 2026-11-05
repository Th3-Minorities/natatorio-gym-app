<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Laravel's users table, reshaped for the User accounts of docs/design/data-model.md (sections 2 and 5).
 * The session table is renamed sign_in_sessions (config/session.php).
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('email')->nullable()->comment('NULL after deletion (D2)');
            $table->string('password')->nullable()->comment('hash, NULL after deletion');
            $table->string('locale', 2)->nullable()->comment('es or en, asked at account creation, NULL after deletion');
            $table->string('current_session_id')->nullable()->comment('the one session allowed in, checked on every request (D3)');
            $table->timestampTz('deleted_at')->nullable()->comment('set when the account is deleted, the row stays (D2)');
            $table->timestampsTz();
        });

        // One account per email, whatever its case. Deleted accounts have NULL email, which never collides.
        DB::statement('CREATE UNIQUE INDEX users_email_unique ON users (lower(email))');
        DB::statement("ALTER TABLE users ADD CONSTRAINT users_locale_check CHECK (locale IN ('es', 'en'))");

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        // Laravel's database session table under its own name; ip_address and user_agent are always NULL (D4).
        Schema::create('sign_in_sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sign_in_sessions');
    }
};
