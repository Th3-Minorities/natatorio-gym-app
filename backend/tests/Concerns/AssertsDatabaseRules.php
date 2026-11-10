<?php

namespace Tests\Concerns;

use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Checks that the database itself rejects a row, with the exact PostgreSQL error code:
 * 23505 unique, 23P01 exclusion, 23514 check, 23503 foreign key, 23502 not null.
 */
trait AssertsDatabaseRules
{
    protected function assertRejected(string $sqlState, Closure $insert): void
    {
        try {
            // A savepoint, so the failed insert does not break the test's own transaction.
            DB::transaction($insert);
        } catch (QueryException $e) {
            $this->assertSame($sqlState, $e->errorInfo[0] ?? null, "Rejected for another reason: {$e->getMessage()}");

            return;
        }

        $this->fail("The database accepted a row it should reject with SQLSTATE {$sqlState}.");
    }
}
