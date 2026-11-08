<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('staff_accounts', function (Blueprint $table) {
            $table->unsignedInteger('session_epoch')->default(0)
                ->comment('+1 on each deactivation; a sign-in made before it ends, even after a reactivation (E-130)');
        });
    }

    public function down(): void
    {
        Schema::table('staff_accounts', function (Blueprint $table) {
            $table->dropColumn('session_epoch');
        });
    }
};
