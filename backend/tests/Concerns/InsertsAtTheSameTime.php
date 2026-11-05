<?php

namespace Tests\Concerns;

use Illuminate\Support\Facades\DB;

/**
 * Two inserts at the same moment (data-model.md section 5): the first transaction is still open
 * when a second process inserts a conflicting row. The second must wait for the first, then fail.
 * A check with SELECT before the INSERT would let both in; only a database rule stops it.
 *
 * Use it in a test class without a wrapping transaction (DatabaseTruncation), because the second
 * process can only see rows that are committed.
 */
trait InsertsAtTheSameTime
{
    /**
     * @param  array<string, mixed>  $first
     * @param  array<string, mixed>  $second
     */
    protected function assertSecondInsertLoses(string $table, array $first, array $second, string $sqlState): void
    {
        $before = DB::table($table)->count();

        DB::beginTransaction();
        DB::table($table)->insert($first);

        $process = proc_open(
            [PHP_BINARY, base_path('tests/Support/second-connection.php')],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
        );
        fwrite($pipes[0], json_encode([
            'connection' => config('database.connections.'.config('database.default')),
            'table' => $table,
            'row' => $second,
        ], JSON_THROW_ON_ERROR));
        fclose($pipes[0]);

        $waited = $this->waitUntilSecondConnectionIsBlocked();

        // Let the second insert go: it either fails now or, with no rule, gets in.
        DB::commit();

        $result = trim(stream_get_contents($pipes[1]));
        $errors = trim(stream_get_contents($pipes[2]));
        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);

        $this->assertTrue($waited, "The second insert never waited for the first one. Output: {$result} {$errors}");
        $this->assertSame($sqlState, $result, "Expected the second insert to fail with SQLSTATE {$sqlState}. {$errors}");
        $this->assertSame($before + 1, DB::table($table)->count(), 'Exactly one of the two rows must be stored.');
    }

    /**
     * These tests commit real rows. Empty every table afterwards, so other test classes
     * (which only roll back their own transaction) start from an empty database.
     */
    protected function emptyEveryTable(): void
    {
        $tables = collect(DB::select("select tablename from pg_tables where schemaname = 'public' and tablename <> 'migrations'"))
            ->pluck('tablename')
            ->implode(', ');

        if ($tables !== '') {
            DB::statement("TRUNCATE {$tables} RESTART IDENTITY CASCADE");
        }
    }

    private function waitUntilSecondConnectionIsBlocked(): bool
    {
        for ($i = 0; $i < 100; $i++) {
            // Inside a transaction PostgreSQL keeps one picture of pg_stat_activity; ask for a fresh one.
            DB::select('select pg_stat_clear_snapshot()');
            $blocked = DB::selectOne(
                "select count(*) as n from pg_stat_activity where application_name = 'second-connection' and wait_event_type = 'Lock'"
            )->n;

            if ($blocked > 0) {
                return true;
            }

            usleep(100_000);
        }

        return false;
    }
}
