<?php

namespace Tests\Feature\Roster;

use App\Http\Controllers\RosterDownloadController;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;
use ZipArchive;

/** The Administrator downloads the whole roster as Word or PDF (REQ-F-100, E-140, A-05 4039:2032, #21). */
class RosterDownloadTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    private StaffAccount $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-08 10:00:00');
        $this->admin = StaffAccount::factory()->admin()->create(['locale' => 'es']);
        RosterRecord::factory()->create([
            'name' => 'Alina Mercado Cruz', 'sport' => 'Voleibol', 'student_number' => '802612346',
            'institutional_email' => 'alina.mercado@upr.edu',
        ]);
        RosterRecord::factory()->removed()->create([
            'name' => 'Darel Colón Vega', 'sport' => 'Baloncesto', 'student_number' => '802398412',
            'institutional_email' => 'darel.colon@upr.edu',
        ]);
    }

    private function download(string $format, ?StaffAccount $as = null): TestResponse
    {
        return $this->actingAs($as ?? $this->admin, 'staff')->fromThePwa()->get("/api/staff/roster/download?format={$format}", ['Accept' => 'application/json']);
    }

    /** The text of word/document.xml inside the .docx. */
    private function wordXml(TestResponse $response): string
    {
        $path = tempnam(sys_get_temp_dir(), 'roster');
        file_put_contents($path, $response->getContent());
        $zip = new ZipArchive;
        $this->assertTrue($zip->open($path) === true, 'The download is not a zip file.');
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        unlink($path);

        return (string) $xml;
    }

    public function test_the_word_file_lists_every_athlete_active_and_withdrawn(): void
    {
        $response = $this->download('docx')->assertOk();

        $this->assertSame(self::DOCX, $response->headers->get('Content-Type'));
        $this->assertSame('attachment; filename=roster-atletas-2026-11-08.docx', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $xml = $this->wordXml($response);
        foreach (['Roster de atletas', 'Correo institucional', 'Alina Mercado Cruz', '802612346', 'alina.mercado@upr.edu', 'Voleibol', 'Activo', 'Darel Colón Vega', 'Retirado'] as $text) {
            $this->assertStringContainsString($text, $xml);
        }
        $this->assertLessThan(strpos($xml, 'Darel'), strpos($xml, 'Alina'), 'Athletes are in name order.');
    }

    public function test_the_pdf_file_is_a_pdf_with_its_own_name(): void
    {
        $response = $this->download('pdf')->assertOk();

        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertSame('attachment; filename=roster-atletas-2026-11-08.pdf', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $this->assertStringStartsWith('%PDF-', (string) $response->getContent());
    }

    public function test_the_file_follows_the_administrator_language(): void
    {
        $english = StaffAccount::factory()->admin()->create(['locale' => 'en']);

        $response = $this->download('docx', $english)->assertOk();

        $this->assertSame('attachment; filename=athlete-roster-2026-11-08.docx', $response->headers->get('Content-Disposition'));
        $xml = $this->wordXml($response);
        $this->assertStringContainsString('Athlete roster', $xml);
        $this->assertStringContainsString('Withdrawn', $xml);
    }

    public function test_text_typed_into_the_roster_stays_plain_text_in_both_files(): void
    {
        RosterRecord::factory()->create(['name' => '<script>alert(1)</script> & Co', 'sport' => "'; DROP TABLE users; --"]);

        $xml = $this->wordXml($this->download('docx')->assertOk());
        $this->assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co', $xml);
        $this->assertNotFalse(simplexml_load_string($xml), 'The Word XML is still valid.');

        $html = view('roster.download', app(RosterDownloadController::class)->pageData($this->admin))->render();
        $this->assertStringContainsString('&lt;script&gt;alert(1)&lt;/script&gt; &amp; Co', $html);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertSame(3, RosterRecord::query()->count());
    }

    public function test_staff_cannot_download_the_roster(): void
    {
        $this->download('docx', StaffAccount::factory()->create())->assertForbidden();
    }

    public function test_a_guest_cannot_download_the_roster(): void
    {
        $this->fromThePwa()->getJson('/api/staff/roster/download?format=pdf')->assertUnauthorized();
    }

    public function test_the_format_must_be_word_or_pdf(): void
    {
        $this->actingAs($this->admin, 'staff')->fromThePwa()->getJson('/api/staff/roster/download?format=xlsx')
            ->assertStatus(422)->assertJsonPath('error.code', 'validation_failed')->assertJsonPath('error.details.format', ['in']);
        $this->actingAs($this->admin, 'staff')->fromThePwa()->getJson('/api/staff/roster/download')
            ->assertStatus(422)->assertJsonPath('error.details.format', ['required']);
    }
}
