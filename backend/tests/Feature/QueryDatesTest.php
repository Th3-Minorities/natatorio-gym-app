<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\TestCase;

class QueryDatesTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_utc_date_in_a_query_is_refused(): void
    {
        $this->expectException(LogicException::class);

        DB::table('users')->where('email_verified_at', '>', Carbon::parse('2026-10-27T01:00:00Z'))->get();
    }

    public function test_a_utc_date_in_an_eloquent_query_is_refused(): void
    {
        $this->expectException(LogicException::class);

        User::where('created_at', '<', Carbon::parse('2026-10-27T01:00:00Z'))->get();
    }

    public function test_a_converted_date_finds_the_row_it_means(): void
    {
        User::factory()->create(['email_verified_at' => '2026-10-27T01:00:00Z']);

        $utc = Carbon::parse('2026-10-27T01:00:00Z');

        $this->assertSame(1, User::where('email_verified_at', $utc->setTimezone(config('app.timezone')))->count());
    }

    public function test_dates_made_by_the_app_are_accepted(): void
    {
        $this->assertSame(0, DB::table('users')->where('created_at', '>', now())->count());
        $this->assertSame(0, DB::table('users')->where('created_at', '>', today())->count());
    }
}
