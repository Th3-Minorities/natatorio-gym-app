<?php

/*
 * The "other request" in the simultaneous Check In test: a separate PHP process with its own database
 * connection. Reads {"connection": {...}, "row": {...}} as JSON on stdin, inserts the facility session
 * inside an open transaction, prints "inserted", then waits until another connection is blocked on a
 * lock (the Check In under test) and only then commits. Used by Tests\Feature\CheckIn\CheckInConcurrencyTest.
 */

$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$db = $input['connection'];

$pdo = new PDO(
    "pgsql:host={$db['host']};port={$db['port']};dbname={$db['database']};options='--application_name=session-holder'",
    $db['username'],
    $db['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);
$pdo->exec("SET TIME ZONE '{$db['timezone']}'");

$columns = array_keys($input['row']);
$pdo->beginTransaction();
$pdo->prepare(sprintf(
    'INSERT INTO facility_sessions (%s) VALUES (%s)',
    implode(', ', $columns),
    implode(', ', array_fill(0, count($columns), '?')),
))->execute(array_values($input['row']));
echo "inserted\n";
flush();

$blocked = false;
for ($i = 0; $i < 100 && ! $blocked; $i++) {
    usleep(100_000);
    // Inside a transaction PostgreSQL keeps one picture of pg_stat_activity; ask for a fresh one.
    $pdo->query('select pg_stat_clear_snapshot()');
    $blocked = (bool) $pdo->query("select count(*) from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid() and wait_event_type = 'Lock'")->fetchColumn();
}

$pdo->commit();
echo $blocked ? 'blocked' : 'never-blocked';
