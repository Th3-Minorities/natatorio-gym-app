<?php

namespace Tests\Feature\Database;

use App\Models\AcademicTerm;
use App\Models\Import;
use Illuminate\Foundation\Testing\DatabaseTruncation;
use Tests\Concerns\InsertsAtTheSameTime;
use Tests\TestCase;

/**
 * Two people at the same moment (data-model.md section 5). No wrapping transaction here
 * (DatabaseTruncation), because the second process only sees committed rows.
 */
class ConcurrentInsertsTest extends TestCase
{
    use DatabaseTruncation, InsertsAtTheSameTime;

    protected function tearDown(): void
    {
        $this->emptyEveryTable();

        parent::tearDown();
    }

    public function test_two_overlapping_terms_at_the_same_time(): void
    {
        $this->assertSecondInsertLoses(
            'academic_terms',
            ['name' => 'Fall', 'starts_on' => '2026-08-15', 'ends_on' => '2026-12-15'],
            ['name' => 'Fall copy', 'starts_on' => '2026-09-01', 'ends_on' => '2026-12-31'],
            '23P01',
        );
    }

    public function test_the_same_authorization_number_at_the_same_time(): void
    {
        $term = AcademicTerm::factory()->create();
        $import = Import::factory()->create();
        $order = [
            'import_id' => $import->id,
            'academic_term_id' => $term->id,
            'authorization_number' => 'A-777',
            'name' => 'Ana Rivera',
            'email' => 'ana@example.com',
            'member_group' => 'student',
            'order_status' => 'completed',
            'paid_at' => '2026-09-01 10:00:00',
            'synced_at' => '2026-09-01 10:05:00',
        ];

        $this->assertSecondInsertLoses(
            'imported_memberships',
            [...$order, 'order_reference' => 'WC-1'],
            [...$order, 'order_reference' => 'WC-2'],
            '23505',
        );
    }
}
