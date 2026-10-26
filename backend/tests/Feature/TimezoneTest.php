<?php

namespace Tests\Feature;

use Illuminate\Support\Carbon;
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
}
