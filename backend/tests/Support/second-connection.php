<?php

/*
 * The "other person" in a same-time test: a separate PHP process with its own database connection.
 * Reads {"connection": {...}, "table": "...", "row": {...}} as JSON on stdin, inserts the row and
 * prints "ok" or the PostgreSQL error code (SQLSTATE). Used by Tests\Concerns\InsertsAtTheSameTime.
 */

$input = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$db = $input['connection'];

$pdo = new PDO(
    "pgsql:host={$db['host']};port={$db['port']};dbname={$db['database']};options='--application_name=second-connection'",
    $db['username'],
    $db['password'],
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION],
);
$pdo->exec("SET TIME ZONE '{$db['timezone']}'");

$columns = array_keys($input['row']);
$sql = sprintf(
    'INSERT INTO %s (%s) VALUES (%s)',
    $input['table'],
    implode(', ', $columns),
    implode(', ', array_fill(0, count($columns), '?')),
);

try {
    $pdo->prepare($sql)->execute(array_values($input['row']));
    echo 'ok';
} catch (PDOException $e) {
    echo $e->errorInfo[0] ?? $e->getCode();
}
