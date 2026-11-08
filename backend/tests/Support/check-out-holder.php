<?php

use App\Models\StaffAccount;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

// Hold the row until another real request blocks, then check out through the HTTP kernel and commit.
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['connection']['database'] ?? null) !== 'natatorio_gym_test') {
    throw new RuntimeException('The concurrency test must use the test database.');
}

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$kernel = $app->make(Kernel::class);
$kernel->bootstrap();
$app['env'] = 'testing';
config([
    'database.default' => 'pgsql', 'database.connections.pgsql' => [...$input['connection'], 'url' => null],
    'session.driver' => 'array', 'cache.default' => 'array', 'logging.default' => 'null',
    'sanctum.stateful' => ['localhost'],
]);
DB::purge('pgsql');
DB::statement("SET application_name = 'check-out-holder'");
DB::beginTransaction();

try {
    DB::table('facility_sessions')->where('id', $input['session_id'])->lockForUpdate()->first();
    echo "locked\n";
    flush();

    $blocked = false;
    for ($i = 0; $i < 100 && ! $blocked; $i++) {
        usleep(100_000);
        DB::select('select pg_stat_clear_snapshot()');
        $blocked = (int) DB::selectOne('SELECT count(*) AS n FROM pg_stat_activity
            WHERE datname = current_database() AND pg_backend_pid() = ANY(pg_blocking_pids(pid))')->n > 0;
    }

    $request = Request::create('/api/staff/sessions/'.$input['session_id'].'/check-out', 'POST', server: [
        'HTTP_ACCEPT' => 'application/json', 'HTTP_ORIGIN' => 'http://localhost', 'HTTP_HOST' => 'localhost',
    ]);
    // The guard needs the request bound before it can be given a user.
    $app->instance('request', $request);
    Auth::guard('staff')->setUser(StaffAccount::query()->findOrFail($input['staff_id']));
    $response = $kernel->handle($request);
    DB::commit();
    echo json_encode(['blocked' => $blocked, 'status' => $response->getStatusCode(),
        'body' => json_decode($response->getContent(), true, flags: JSON_THROW_ON_ERROR)], JSON_THROW_ON_ERROR);
    $kernel->terminate($request, $response);
} finally {
    if (DB::transactionLevel() > 0) {
        DB::rollBack();
    }
}
