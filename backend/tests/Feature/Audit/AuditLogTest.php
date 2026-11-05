<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use App\Services\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Route;
use LogicException;
use Tests\TestCase;

/** The audit log service the gym features call (REQ-NF-39, E-108). */
class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // A stand-in for a gym action: it records one entry about the staff account it changed.
        Route::post('/api/test/audit', function (AuditLog $log) {
            $subject = StaffAccount::query()->firstWhere('email', 'subject@example.com');

            $log->record('test_change', $subject, ['role' => 'staff'], ['role' => 'admin'], 'a reason for the change');

            return response()->noContent();
        });
    }

    public function test_an_entry_names_the_staff_account_and_the_change(): void
    {
        $this->travelTo(Carbon::parse('2026-11-05 15:05:00'));
        $admin = StaffAccount::factory()->admin()->create();
        $subject = StaffAccount::factory()->create(['email' => 'subject@example.com']);

        $this->actingAs($admin, 'staff')
            ->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->withHeader('User-Agent', 'Safari on iPhone')
            ->post('/api/test/audit')
            ->assertNoContent();

        $entry = AuditLogEntry::query()->sole();
        $this->assertTrue($entry->staffAccount->is($admin));
        $this->assertSame('2026-11-05 15:05:00', $entry->occurred_at->format('Y-m-d H:i:s'));
        $this->assertSame('203.0.113.7', $entry->ip_address);
        $this->assertSame('Safari on iPhone', $entry->user_agent);
        $this->assertSame('test_change', $entry->action);
        $this->assertSame('staff_accounts', $entry->subject_table);
        $this->assertSame($subject->id, $entry->subject_id);
        $this->assertSame(['role' => 'staff'], $entry->before_values);
        $this->assertSame(['role' => 'admin'], $entry->after_values);
        $this->assertSame('a reason for the change', $entry->reason);
    }

    public function test_a_forwarded_ip_from_an_untrusted_address_is_ignored(): void
    {
        // Anyone can send this header; only a proxy we trust may set the IP.
        $this->actingAs(StaffAccount::factory()->create(), 'staff')
            ->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->withHeader('X-Forwarded-For', '198.51.100.1')
            ->post('/api/test/audit');

        $this->assertSame('203.0.113.7', AuditLogEntry::query()->sole()->ip_address);
    }

    public function test_a_trusted_proxy_passes_on_the_real_ip(): void
    {
        config(['app.trusted_proxies' => ['172.18.0.1']]);

        $this->actingAs(StaffAccount::factory()->create(), 'staff')
            ->withServerVariables(['REMOTE_ADDR' => '172.18.0.1'])
            ->withHeader('X-Forwarded-For', '198.51.100.1')
            ->post('/api/test/audit');

        $this->assertSame('198.51.100.1', AuditLogEntry::query()->sole()->ip_address);
    }

    public function test_a_gym_action_without_a_staff_sign_in_cannot_be_recorded(): void
    {
        // An entry with no account means a system alert, so a missing sign-in must not look like one.
        $this->withoutExceptionHandling();
        $this->expectException(LogicException::class);

        $this->post('/api/test/audit');
    }

    public function test_a_system_alert_has_no_account_ip_or_browser(): void
    {
        app(AuditLog::class)->recordSystem('global_lookup_limit', after: ['lookups' => 50]);

        $entry = AuditLogEntry::query()->sole();
        $this->assertNull($entry->staff_account_id);
        $this->assertNull($entry->ip_address);
        $this->assertNull($entry->user_agent);
        $this->assertSame('global_lookup_limit', $entry->action);
        $this->assertSame(['lookups' => 50], $entry->after_values);
    }

    public function test_an_entry_cannot_be_edited(): void
    {
        $entry = AuditLogEntry::factory()->create(['action' => 'test_change']);

        $this->expectException(LogicException::class);

        $entry->update(['action' => 'something_else']);
    }

    public function test_an_entry_cannot_be_deleted(): void
    {
        $entry = AuditLogEntry::factory()->create();

        $this->expectException(LogicException::class);

        $entry->delete();
    }
}
