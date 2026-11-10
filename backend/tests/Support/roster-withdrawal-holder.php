<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

// The Administrator's withdrawal (A-05 "Retirar") in a second process: it locks the roster record, marks it removed
// and revokes its active authorizations, the same steps as the roster screen, then holds the transaction open until
// another request waits behind its lock (or 10 seconds pass), and commits.
$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
if (($input['connection']['database'] ?? null) !== 'natatorio_gym_test') {
    throw new RuntimeException('The concurrency test must use the test database.');
}

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
config(['database.default' => 'pgsql', 'database.connections.pgsql' => [...$input['connection'], 'url' => null], 'logging.default' => 'null']);
DB::purge('pgsql');
DB::statement("SET application_name = 'roster-withdrawal-holder'");
DB::beginTransaction();

try {
    DB::table('roster_records')->where('id', $input['roster_record_id'])->lockForUpdate()->first();
    DB::table('roster_records')->where('id', $input['roster_record_id'])->update(['removed_at' => now(), 'updated_at' => now()]);
    DB::table('authorizations')->where('roster_record_id', $input['roster_record_id'])->where('status', 'active')
        ->update(['status' => 'revoked', 'reason' => 'removed from roster', 'updated_at' => now()]);
    echo "locked\n";
    flush();

    $blocked = false;
    for ($i = 0; $i < 100 && ! $blocked; $i++) {
        usleep(100_000);
        DB::select('select pg_stat_clear_snapshot()');
        $blocked = (int) DB::selectOne('SELECT count(*) AS n FROM pg_stat_activity
            WHERE datname = current_database() AND pg_backend_pid() = ANY(pg_blocking_pids(pid))')->n > 0;
    }

    DB::commit();
    echo json_encode(['blocked' => $blocked], JSON_THROW_ON_ERROR);
} finally {
    if (DB::transactionLevel() > 0) {
        DB::rollBack();
    }
}
