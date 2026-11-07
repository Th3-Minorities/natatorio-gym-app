<?php

namespace Tests\Feature\StaffAccounts;

use App\Models\AuditLogEntry;
use App\Models\EmailLink;
use App\Models\StaffAccount;
use App\Notifications\StaffInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** An Administrator lists staff accounts, invites a person by email and resends the invitation (REQ-F-88, A-15). */
class StaffInviteTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private StaffAccount $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
        $this->freezeSecond();
        $this->admin = StaffAccount::factory()->admin()->create(['name' => 'Lorena Ortiz']);
    }

    private function asAdmin(): static
    {
        return $this->actingAs($this->admin, 'staff')->fromThePwa();
    }

    private function invite(array $input = []): TestResponse
    {
        return $this->asAdmin()->postJson('/api/staff/accounts', [
            'name' => 'Yariel Nieves León',
            'email' => 'yariel.nieves@example.edu',
            'role' => 'staff',
            ...$input,
        ]);
    }

    public function test_the_list_shows_each_account_with_its_status(): void
    {
        StaffAccount::factory()->create(['name' => 'Mariel Vélez Soto']);
        StaffAccount::factory()->create(['name' => 'Nayeli Lugo Paz', 'password' => null]);
        StaffAccount::factory()->deactivated()->create(['name' => 'Damián Ruiz Solís']);

        $accounts = $this->asAdmin()->getJson('/api/staff/accounts')->assertOk()->json('accounts');

        $this->assertSame(
            [
                ['Lorena Ortiz', 'admin', 'active'],
                ['Mariel Vélez Soto', 'staff', 'active'],
                ['Nayeli Lugo Paz', 'staff', 'invited'],
                ['Damián Ruiz Solís', 'staff', 'deactivated'],
            ],
            array_map(fn ($a) => [$a['name'], $a['role'], $a['status']], $accounts),
        );
        $this->assertSame(['id', 'name', 'email', 'role', 'status'], array_keys($accounts[0]));
    }

    public function test_an_invite_creates_an_account_without_a_password_and_emails_a_single_use_link(): void
    {
        $this->invite()->assertCreated()
            ->assertJsonPath('account.status', 'invited')
            ->assertJsonPath('account.role', 'staff');

        $account = StaffAccount::query()->where('email', 'yariel.nieves@example.edu')->sole();
        $this->assertNull($account->password);
        $this->assertSame('es', $account->locale);

        $link = EmailLink::query()->where('staff_account_id', $account->id)->sole();
        $this->assertSame('staff_invite', $link->purpose);
        $this->assertNull($link->used_at);
        $this->assertTrue($link->expires_at->equalTo(now()->addDays(7)));

        Notification::assertSentTo($account, StaffInvitation::class, function (StaffInvitation $mail) use ($link) {
            // Only the hash is stored; the email carries the token itself.
            return hash('sha256', $mail->token) === $link->token_hash;
        });
    }

    public function test_an_invite_writes_the_audit_log_without_the_email(): void
    {
        $this->invite(['role' => 'admin'])->assertCreated();

        $entry = AuditLogEntry::query()->where('action', 'staff.invite')->sole();
        $this->assertSame($this->admin->id, $entry->staff_account_id);
        $this->assertSame('staff_accounts', $entry->subject_table);
        $this->assertSame(['name' => 'Yariel Nieves León', 'role' => 'admin'], $entry->after_values);
    }

    public function test_an_email_already_used_by_a_staff_account_is_refused_in_any_case(): void
    {
        StaffAccount::factory()->deactivated()->create(['email' => 'yariel.nieves@example.edu']);

        $this->invite(['email' => 'Yariel.Nieves@EXAMPLE.edu'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation_failed')
            ->assertJsonPath('error.details.email', ['unique']);
        Notification::assertNothingSent();
    }

    public function test_the_inputs_are_checked_on_the_server(): void
    {
        $this->invite(['name' => '', 'email' => 'not-an-email', 'role' => 'owner'])
            ->assertUnprocessable()
            ->assertJsonPath('error.details.name', ['required'])
            ->assertJsonPath('error.details.email', ['email'])
            ->assertJsonPath('error.details.role', ['in']);

        $this->invite(['name' => str_repeat('a', 256)])->assertJsonPath('error.details.name', ['max']);
        $this->assertSame(1, StaffAccount::query()->count());
    }

    public function test_injection_attempts_are_kept_as_plain_text(): void
    {
        $name = "Robert'); DROP TABLE staff_accounts;-- <script>alert(1)</script>";
        $this->invite(['name' => $name])->assertCreated()->assertJsonPath('account.name', $name);

        $this->assertSame($name, StaffAccount::query()->where('email', 'yariel.nieves@example.edu')->value('name'));
        $this->invite(['email' => "x' OR '1'='1@example.edu"])->assertUnprocessable();
    }

    public function test_resending_replaces_the_old_link(): void
    {
        $this->invite()->assertCreated();
        $account = StaffAccount::query()->where('email', 'yariel.nieves@example.edu')->sole();
        $old = EmailLink::query()->where('staff_account_id', $account->id)->sole();

        $this->asAdmin()->postJson("/api/staff/accounts/{$account->id}/invitation")->assertNoContent();

        $this->assertModelMissing($old);
        $this->assertSame(1, EmailLink::query()->where('staff_account_id', $account->id)->count());
        Notification::assertSentToTimes($account, StaffInvitation::class, 2);
        $this->assertSame(1, AuditLogEntry::query()->where('action', 'staff.invite_resend')->count());
    }

    public function test_only_invited_accounts_get_a_new_invitation(): void
    {
        $active = StaffAccount::factory()->create();
        $deactivated = StaffAccount::factory()->deactivated()->create(['password' => null]);

        foreach ([$active, $deactivated] as $account) {
            $this->asAdmin()->postJson("/api/staff/accounts/{$account->id}/invitation")
                ->assertConflict()
                ->assertJsonPath('error.code', 'staff_account_not_invited');
        }
        Notification::assertNothingSent();
    }

    public function test_an_unknown_account_is_not_found(): void
    {
        $this->asAdmin()->postJson('/api/staff/accounts/999999/invitation')->assertNotFound();
        $this->asAdmin()->postJson('/api/staff/accounts/abc/invitation')->assertNotFound();
    }

    public function test_staff_are_forbidden_to_list_or_invite(): void
    {
        $staff = StaffAccount::factory()->create();
        $invited = StaffAccount::factory()->create(['password' => null]);

        $this->actingAs($staff, 'staff')->fromThePwa()->getJson('/api/staff/accounts')
            ->assertForbidden()->assertJsonPath('error.code', 'forbidden');
        $this->actingAs($staff, 'staff')->fromThePwa()->postJson('/api/staff/accounts', [
            'name' => 'X', 'email' => 'x@example.edu', 'role' => 'admin',
        ])->assertForbidden();
        $this->actingAs($staff, 'staff')->fromThePwa()->postJson("/api/staff/accounts/{$invited->id}/invitation")
            ->assertForbidden();
        Notification::assertNothingSent();
    }

    public function test_nobody_signed_in_cannot_list_or_invite(): void
    {
        $this->fromThePwa()->getJson('/api/staff/accounts')->assertUnauthorized();
        $this->fromThePwa()->postJson('/api/staff/accounts', [])->assertUnauthorized();
    }
}
