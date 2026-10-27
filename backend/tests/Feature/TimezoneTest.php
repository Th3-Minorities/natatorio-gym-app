<?php

namespace Tests\Feature;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TimezoneTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_today_is_the_puerto_rico_date_late_in_the_evening(): void
    {
        // 9:00 PM in Puerto Rico is 1:00 AM of the next day in UTC (REQ-NF-37).
        Carbon::setTestNow(Carbon::parse('2026-10-26 21:00:00', 'America/Puerto_Rico'));

        $this->assertSame('2026-10-26', today()->toDateString());
        $this->assertSame('21:00', now()->format('H:i'));
    }

    public function test_the_database_stores_the_same_moment_php_means(): void
    {
        // Laravel sends dates to the database without a time zone ('Y-m-d H:i:s').
        // If PostgreSQL reads them in another zone, every timestamptz is saved hours off.
        $nineInTheEvening = Carbon::parse('2026-10-26 21:00:00', 'America/Puerto_Rico');

        $stored = DB::selectOne('select ?::timestamptz as moment', [$nineInTheEvening->format('Y-m-d H:i:s')])->moment;

        $this->assertSame('2026-10-27 01:00:00', Carbon::parse($stored)->utc()->toDateTimeString());
    }
}
