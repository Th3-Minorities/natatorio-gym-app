<?php

namespace App\Database;

use DateTimeInterface;
use Illuminate\Database\PostgresConnection as BasePostgresConnection;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * Turns the rule "convert a UTC date to Puerto Rico time before using it in a query"
 * (docs/design/api-conventions.md, "Time zones") into an error. Laravel sends a date to PostgreSQL
 * as 'Y-m-d H:i:s' in the zone of the Carbon, and PostgreSQL reads that text as Puerto Rico time,
 * so a UTC Carbon would silently match the wrong rows.
 */
class PostgresConnection extends BasePostgresConnection
{
    public function prepareBindings(array $bindings)
    {
        foreach ($bindings as $value) {
            if ($value instanceof DateTimeInterface
                && $value->getOffset() !== Carbon::instance($value)->setTimezone(config('app.timezone'))->getOffset()) {
                throw new LogicException(
                    'A date in another time zone was used in a query. Convert it first with ->setTimezone(config(\'app.timezone\')).',
                );
            }
        }

        return parent::prepareBindings($bindings);
    }
}
