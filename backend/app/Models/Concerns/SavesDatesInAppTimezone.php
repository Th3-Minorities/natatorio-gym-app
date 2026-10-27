<?php

namespace App\Models\Concerns;

/**
 * Laravel writes a date as 'Y-m-d H:i:s' in the zone of the Carbon it receives, without converting.
 * A UTC date from the API ('2026-10-27T01:00:00Z') would reach PostgreSQL as 01:00, which the
 * connection reads as Puerto Rico time: 4 hours late. Every model uses this trait to convert first.
 */
trait SavesDatesInAppTimezone
{
    public function fromDateTime($value)
    {
        return empty($value) ? $value : $this->asDateTime($value)
            ->setTimezone(config('app.timezone'))
            ->format($this->getDateFormat());
    }
}
