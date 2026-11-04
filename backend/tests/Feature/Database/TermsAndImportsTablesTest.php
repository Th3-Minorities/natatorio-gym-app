<?php

namespace Tests\Feature\Database;

use App\Models\AcademicTerm;
use App\Models\Import;
use App\Models\ImportedMembership;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\AssertsDatabaseRules;
use Tests\TestCase;

/** Rules for academic_terms, imports and imported_memberships (data-model.md sections 5 and 6). */
class TermsAndImportsTablesTest extends TestCase
{
    use AssertsDatabaseRules, RefreshDatabase;

    public function test_a_term_cannot_end_before_it_starts(): void
    {
        $this->assertRejected('23514', fn () => $this->term('2026-12-15', '2026-08-15'));
    }

    public function test_terms_cannot_overlap(): void
    {
        $this->term('2026-08-15', '2026-12-15');

        $this->assertRejected('23P01', fn () => $this->term('2026-12-15', '2027-05-15'));
        $this->assertRejected('23P01', fn () => $this->term('2026-09-01', '2026-10-01'));
    }

    public function test_terms_may_touch_with_no_gap_or_overlap(): void
    {
        $this->term('2026-08-15', '2026-12-15');
        $this->term('2026-12-16', '2027-05-15');

        $this->assertSame(2, DB::table('academic_terms')->count());
    }

    public function test_an_order_is_stored_once(): void
    {
        $order = $this->membershipRow(['order_reference' => 'WC-1001']);
        DB::table('imported_memberships')->insert($order);

        $this->assertRejected('23505', fn () => DB::table('imported_memberships')->insert(
            [...$order, 'authorization_number' => 'OTHER-NUMBER'],
        ));
    }

    public function test_an_authorization_number_is_unique_within_a_term(): void
    {
        DB::table('imported_memberships')->insert($this->membershipRow(['authorization_number' => 'A-500']));

        $this->assertRejected('23505', fn () => DB::table('imported_memberships')->insert(
            $this->membershipRow(['authorization_number' => 'A-500', 'order_reference' => 'WC-OTHER']),
        ));
    }

    public function test_the_same_number_is_allowed_in_another_term(): void
    {
        $fall = $this->term('2026-08-15', '2026-12-15');
        $spring = $this->term('2027-01-10', '2027-05-15');

        DB::table('imported_memberships')->insert($this->membershipRow(['academic_term_id' => $fall, 'authorization_number' => 'A-500', 'order_reference' => 'WC-1']));
        DB::table('imported_memberships')->insert($this->membershipRow(['academic_term_id' => $spring, 'authorization_number' => 'A-500', 'order_reference' => 'WC-2']));

        $this->assertSame(2, DB::table('imported_memberships')->where('authorization_number', 'A-500')->count());
    }

    public function test_an_order_needs_a_term(): void
    {
        $this->assertRejected('23502', fn () => DB::table('imported_memberships')->insert(
            $this->membershipRow(['academic_term_id' => null]),
        ));
    }

    public function test_a_term_with_orders_cannot_be_deleted(): void
    {
        $order = ImportedMembership::factory()->create();

        $this->assertRejected('23503', fn () => DB::table('academic_terms')->where('id', $order->academic_term_id)->delete());
    }

    public function test_an_import_with_orders_cannot_be_deleted(): void
    {
        $order = ImportedMembership::factory()->create();

        $this->assertRejected('23503', fn () => DB::table('imports')->where('id', $order->import_id)->delete());
    }

    public function test_the_factories_make_valid_rows(): void
    {
        AcademicTerm::factory()->count(3)->create();
        Import::factory()->create();
        ImportedMembership::factory()->count(3)->create();

        $this->assertSame(3, DB::table('imported_memberships')->count());
        $this->assertGreaterThanOrEqual(3, DB::table('academic_terms')->count());
    }

    private function term(string $startsOn, string $endsOn): int
    {
        return DB::table('academic_terms')->insertGetId(['name' => "{$startsOn} to {$endsOn}", 'starts_on' => $startsOn, 'ends_on' => $endsOn]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function membershipRow(array $overrides = []): array
    {
        $termId = $overrides['academic_term_id'] ?? DB::table('academic_terms')->value('id') ?? $this->term('2026-08-15', '2026-12-15');

        return [
            'import_id' => DB::table('imports')->value('id') ?? DB::table('imports')->insertGetId(['file_name' => 'orders.csv', 'result' => '{}']),
            'academic_term_id' => $termId,
            'order_reference' => 'WC-1000',
            'authorization_number' => 'A-100',
            'name' => 'Ana Rivera',
            'email' => 'ana@example.com',
            'order_status' => 'completed',
            'paid_at' => '2026-09-01 10:00:00',
            'synced_at' => '2026-09-01 10:05:00',
            ...$overrides,
        ];
    }
}
