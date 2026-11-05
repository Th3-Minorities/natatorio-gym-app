<?php

namespace Tests\Feature\Database;

use App\Models\FacilityInformation;
use App\Models\Notice;
use App\Models\ScheduleSlot;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\AssertsDatabaseRules;
use Tests\TestCase;

/** Rules for settings, notices, facility_information and schedule_slots (data-model.md section 5). */
class ContentAndScheduleTablesTest extends TestCase
{
    use AssertsDatabaseRules, RefreshDatabase;

    public function test_a_setting_is_found_by_its_name(): void
    {
        DB::table('settings')->insert(['name' => 'contact_phone', 'value' => '787-555-0100']);

        $this->assertSame('787-555-0100', DB::table('settings')->where('name', 'contact_phone')->value('value'));
        $this->assertRejected('23505', fn () => DB::table('settings')->insert(['name' => 'contact_phone', 'value' => 'other']));
    }

    public function test_facility_topic_must_be_a_known_topic(): void
    {
        DB::table('facility_information')->insert(['topic' => 'towel', 'text_es' => 'Traiga toalla.']);

        $this->assertRejected('23514', fn () => DB::table('facility_information')->insert(['topic' => 'pool', 'text_es' => 'Piscina.']));
    }

    public function test_a_slot_is_weekly_or_dated_never_both(): void
    {
        DB::table('schedule_slots')->insert($this->weeklySlot());
        DB::table('schedule_slots')->insert($this->datedSlot());

        $this->assertSame(2, DB::table('schedule_slots')->count());
        $this->assertRejected('23514', fn () => DB::table('schedule_slots')->insert(
            [...$this->weeklySlot(), 'starts_at' => '2026-11-04 08:00:00', 'ends_at' => '2026-11-04 12:00:00'],
        ));
        $this->assertRejected('23514', fn () => DB::table('schedule_slots')->insert(['type' => 'regular_hours']));
    }

    public function test_slot_type_must_be_a_known_type(): void
    {
        $this->assertRejected('23514', fn () => DB::table('schedule_slots')->insert([...$this->weeklySlot(), 'type' => 'holiday']));
    }

    public function test_special_hours_and_closures_must_be_dated(): void
    {
        $this->assertRejected('23514', fn () => DB::table('schedule_slots')->insert([...$this->weeklySlot(), 'type' => 'closure']));
        $this->assertRejected('23514', fn () => DB::table('schedule_slots')->insert([...$this->weeklySlot(), 'type' => 'special_hours']));
    }

    public function test_a_notice_needs_spanish_text_and_a_start(): void
    {
        DB::table('notices')->insert(['text_es' => 'Cerrado el jueves.', 'shown_from' => '2026-11-04 08:00:00']);

        $this->assertRejected('23502', fn () => DB::table('notices')->insert(['shown_from' => '2026-11-04 08:00:00']));
        $this->assertRejected('23502', fn () => DB::table('notices')->insert(['text_es' => 'Sin fecha.']));
    }

    public function test_the_factories_make_valid_rows(): void
    {
        Setting::factory()->create();
        Notice::factory()->create();
        FacilityInformation::factory()->create();
        ScheduleSlot::factory()->create();
        ScheduleSlot::factory()->dated()->create();

        $this->assertSame(1, DB::table('settings')->count());
        $this->assertSame(1, DB::table('notices')->count());
        $this->assertSame(1, DB::table('facility_information')->count());
        $this->assertSame(1, DB::table('schedule_slots')->whereNotNull('weekday')->count());
        $this->assertSame(1, DB::table('schedule_slots')->whereNotNull('starts_at')->count());
    }

    /** @return array<string, mixed> */
    private function weeklySlot(): array
    {
        return ['type' => 'regular_hours', 'weekday' => 1, 'start_time' => '06:00', 'end_time' => '22:00'];
    }

    /** @return array<string, mixed> */
    private function datedSlot(): array
    {
        return ['type' => 'closure', 'starts_at' => '2026-12-24 00:00:00', 'ends_at' => '2026-12-26 00:00:00', 'text_es' => 'Cerrado por Navidad.'];
    }
}
