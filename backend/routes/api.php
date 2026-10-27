<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// Every route here is served under /api (docs/design/api-conventions.md).

Route::get('/health', HealthController::class);
