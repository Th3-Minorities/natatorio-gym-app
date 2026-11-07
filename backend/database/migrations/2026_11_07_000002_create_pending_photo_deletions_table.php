<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_photo_deletions', function (Blueprint $table) {
            $table->id();
            $table->string('path');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_photo_deletions');
    }
};
