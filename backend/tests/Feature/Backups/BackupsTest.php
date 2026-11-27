<?php

namespace Tests\Feature\Backups;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use App\Models\User;
use App\Services\AuditLog;
use App\Services\Backups;
use Illuminate\Database\Events\NoPendingMigrations;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Process\PendingProcess;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** A-16 backups (#86): roles, the 2 kept copies, one at a time, the encrypted download and the restore. */
class BackupsTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    private const PASSWORD = 'correct horse battery';

    private StaffAccount $admin;

    private string $folder;

    /** Commands that fail in this test, by program name. */
    private array $failing = [];

    /** The pg_restore commands that ran, and what ran in order. */
    private array $restores = [];

    private array $ran = [];

    /** Runs when pg_restore does, to break something in this test. */
    private ?\Closure $whenRestoring = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo('2026-11-18 10:15:00');
        $this->folder = sys_get_temp_dir().'/backups-test-'.uniqid();
        config(['backups.path' => $this->folder]);
        Storage::fake('local');
        $this->admin = StaffAccount::factory()->admin()->create();

        // No real pg_dump, pg_restore or tar: "tar --create" writes a small file where the backup goes.
        Process::fake(function (PendingProcess $process) {
            $command = $process->command;
            $this->ran[] = $command[0];
            if (in_array($command[0], $this->failing, true)) {
                return Process::result(exitCode: 1, errorOutput: 'simulated failure');
            }
            if ($command[0] === 'tar' && $command[1] === '--create') {
                file_put_contents(substr($command[2], strlen('--file=')), 'database and photos');
            }

            if ($command[0] === 'pg_restore') {
                $this->restores[] = $command;
                if ($this->whenRestoring) {
                    ($this->whenRestoring)();
                }
            }

            return Process::result();
        });
        // The test database is migrated already, so migrate runs and reports nothing to do.
        Event::listen(NoPendingMigrations::class, fn () => $this->ran[] = 'migrate');
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->folder);
        parent::tearDown();
    }

    private function copy(string $stamp, string $content = 'a backup'): string
    {
        File::ensureDirectoryExists($this->folder);
        file_put_contents("{$this->folder}/backup-{$stamp}.tar", $content);

        return "backup-{$stamp}.tar";
    }

    private function asAdmin(): static
    {
        return $this->actingAs($this->admin, 'staff')->fromThePwa();
    }

    public function test_only_administrators_reach_the_backups(): void
    {
        $name = $this->copy('2026-11-04-020000');
        $staff = StaffAccount::factory()->create();
        $routes = [
            ['GET', '/api/staff/backups', []],
            ['POST', '/api/staff/backups', []],
            ['POST', "/api/staff/backups/{$name}/download", ['password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD]],
            ['POST', "/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR']],
        ];

        foreach ($routes as [$method, $uri, $data]) {
            $this->fromThePwa()->json($method, $uri, $data)->assertUnauthorized();
        }
        foreach ($routes as [$method, $uri, $data]) {
            $this->actingAs($staff, 'staff')->fromThePwa()->json($method, $uri, $data)->assertForbidden();
        }
        Process::assertNothingRan();
        $this->assertSame(0, AuditLogEntry::query()->count());
    }

    public function test_the_list_shows_each_copy_newest_first_and_the_next_automatic_backup(): void
    {
        $this->copy('2026-10-21-020000', str_repeat('x', 20));
        $this->copy('2026-11-04-020000', str_repeat('x', 30));

        $this->asAdmin()->getJson('/api/staff/backups')->assertOk()->assertJson([
            'running' => false,
            'kept' => 2,
            'backups' => [
                ['name' => 'backup-2026-11-04-020000.tar', 'size' => 30],
                ['name' => 'backup-2026-10-21-020000.tar', 'size' => 20],
            ],
            // 14 days after 4 nov is 18 nov, and 2:00 already passed today, so the next is tomorrow at 2:00.
            'next_at' => '2026-11-19T06:00:00.000000Z',
            'failed_at' => null,
            'last_restore' => null,
        ]);
    }

    public function test_back_up_now_dumps_the_database_and_photos_keeps_two_and_writes_the_audit_log(): void
    {
        $this->copy('2026-10-21-020000');
        $this->copy('2026-11-04-020000');

        $this->asAdmin()->postJson('/api/staff/backups')->assertStatus(202);

        Process::assertRan(fn (PendingProcess $process) => $process->command[0] === 'pg_dump'
            && in_array('--format=custom', $process->command, true));
        Process::assertRan(fn (PendingProcess $process) => $process->command[0] === 'tar' && in_array('photos', $process->command, true));
        $names = array_column(app(Backups::class)->list(), 'name');
        $this->assertSame(['backup-2026-11-18-101500.tar', 'backup-2026-11-04-020000.tar'], $names, 'The oldest copy is deleted.');
        $entry = AuditLogEntry::query()->sole();
        $this->assertSame('backup.create', $entry->action);
        $this->assertSame($this->admin->id, $entry->staff_account_id);
        $this->assertSame(['name' => 'backup-2026-11-18-101500.tar'], $entry->after_values);
        $this->assertFalse(app(Backups::class)->running());
    }

    public function test_a_second_backup_or_a_restore_is_refused_while_one_runs(): void
    {
        $name = $this->copy('2026-11-04-020000');
        file_put_contents("{$this->folder}/running", '');

        $this->asAdmin()->postJson('/api/staff/backups')->assertStatus(409)->assertJsonPath('error.code', 'backup_running');
        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])
            ->assertStatus(409)->assertJsonPath('error.code', 'backup_running');
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('running', true);
        Process::assertNothingRan();
    }

    public function test_a_running_mark_left_by_a_dead_process_does_not_block_forever(): void
    {
        File::ensureDirectoryExists($this->folder);
        touch("{$this->folder}/running", time() - 7 * 3600);

        $this->asAdmin()->postJson('/api/staff/backups')->assertStatus(202);
    }

    public function test_a_failed_backup_keeps_the_copies_shows_the_failure_and_writes_the_audit_log(): void
    {
        $this->copy('2026-11-04-020000');
        $this->failing = ['pg_dump'];

        $this->asAdmin()->postJson('/api/staff/backups')->assertStatus(202);

        $this->asAdmin()->getJson('/api/staff/backups')->assertOk()
            ->assertJsonPath('running', false)
            ->assertJsonPath('failed_at', '2026-11-18T14:15:00.000000Z')
            ->assertJsonCount(1, 'backups');
        $this->assertSame('backup.failed', AuditLogEntry::query()->sole()->action);
    }

    public function test_the_download_is_encrypted_with_the_password_in_openssl_format(): void
    {
        $content = random_bytes(70000);
        $name = $this->copy('2026-11-04-020000', $content);

        $response = $this->asAdmin()->postJson("/api/staff/backups/{$name}/download", [
            'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD,
        ])->assertOk();

        $this->assertSame("attachment; filename={$name}.enc", $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        $encrypted = $response->streamedContent();
        // openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 does exactly this.
        $this->assertStringStartsWith('Salted__', $encrypted);
        $derived = hash_pbkdf2('sha256', self::PASSWORD, substr($encrypted, 8, 8), 600000, 48, true);
        $plain = openssl_decrypt(substr($encrypted, 16), 'aes-256-cbc', substr($derived, 0, 32), OPENSSL_RAW_DATA, substr($derived, 32, 16));
        $this->assertSame($content, $plain);
        $this->assertStringNotContainsString($content, $encrypted);

        $entry = AuditLogEntry::query()->sole();
        $this->assertSame('backup.download', $entry->action);
        $this->assertSame(['name' => $name], $entry->after_values);
        $this->assertStringNotContainsString(self::PASSWORD, json_encode($entry->toArray()));
    }

    public function test_the_download_treats_a_hostile_password_as_plain_text(): void
    {
        $password = "'; DROP TABLE staff_accounts; --<script>alert(1)</script>";
        $name = $this->copy('2026-11-04-020000', 'a backup');

        $response = $this->asAdmin()->postJson("/api/staff/backups/{$name}/download", [
            'password' => $password, 'password_confirmation' => $password,
        ])->assertOk();

        $encrypted = $response->streamedContent();
        $derived = hash_pbkdf2('sha256', $password, substr($encrypted, 8, 8), 600000, 48, true);
        $plain = openssl_decrypt(substr($encrypted, 16), 'aes-256-cbc', substr($derived, 0, 32), OPENSSL_RAW_DATA, substr($derived, 32, 16));
        $this->assertSame('a backup', $plain);
        $this->assertDatabaseHas('staff_accounts', ['id' => $this->admin->id]);
    }

    public function test_the_download_refuses_a_password_typed_differently_or_missing(): void
    {
        $name = $this->copy('2026-11-04-020000');

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/download", [
            'password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD.'x',
        ])->assertStatus(422)->assertJsonPath('error.details.password', ['confirmed']);
        $this->asAdmin()->postJson("/api/staff/backups/{$name}/download", [])
            ->assertStatus(422)->assertJsonPath('error.details.password', ['required']);
        $this->asAdmin()->postJson("/api/staff/backups/{$name}/download", ['password' => 'short', 'password_confirmation' => 'short'])
            ->assertStatus(422)->assertJsonPath('error.details.password', ['min']);
        $this->assertSame(0, AuditLogEntry::query()->count());
    }

    public function test_only_copies_in_the_backup_folder_can_be_reached(): void
    {
        $data = ['password' => self::PASSWORD, 'password_confirmation' => self::PASSWORD];

        $this->asAdmin()->postJson('/api/staff/backups/backup-2026-01-01-000000.tar/download', $data)
            ->assertNotFound()->assertJsonPath('error.code', 'backup_not_found');
        $this->asAdmin()->postJson('/api/staff/backups/..%2F..%2F.env/download', $data)->assertNotFound();
        $this->asAdmin()->postJson('/api/staff/backups/state.json/restore', ['confirmation' => 'RESTAURAR'])->assertNotFound();
    }

    public function test_a_restore_needs_restaurar_typed_exactly(): void
    {
        $name = $this->copy('2026-11-04-020000');

        foreach ([null, 'restaurar', 'RESTAURAR.', "RESTAURAR'; DROP TABLE staff_accounts; --", '<script>alert(1)</script>'] as $typed) {
            $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => $typed])
                ->assertStatus(422)->assertJsonPath('error.code', 'validation_failed');
        }
        Process::assertNothingRan();
        $this->assertSame(0, AuditLogEntry::query()->count());
        $this->assertDatabaseHas('staff_accounts', ['id' => $this->admin->id]);
    }

    public function test_a_restore_replaces_the_database_and_photos_and_brings_the_app_back(): void
    {
        $name = $this->copy('2026-11-04-020000');
        Storage::disk('local')->put('photos/newer.jpg', 'a photo taken after the backup');

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        Process::assertRan(fn (PendingProcess $process) => $process->command[0] === 'pg_restore'
            && in_array('--single-transaction', $process->command, true));
        $this->assertFalse(app()->isDownForMaintenance());
        Storage::disk('local')->assertMissing('photos/newer.jpg');
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('last_restore.name', $name)
            ->assertJsonPath('last_restore.ok', true)->assertJsonPath('running', false);
        $entry = AuditLogEntry::query()->sole();
        $this->assertSame('backup.restore', $entry->action);
        $this->assertSame($this->admin->id, $entry->staff_account_id);
    }

    public function test_a_restore_migrates_after_pg_restore_and_restores_every_table(): void
    {
        $name = $this->copy('2026-11-04-020000');

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        $restore = array_values(array_filter($this->ran, fn ($ran) => in_array($ran, ['pg_restore', 'migrate'], true)));
        $this->assertSame(['pg_restore', 'migrate'], $restore, 'One pg_restore, then migrate.');
        $this->assertCount(1, $this->restores);
        $this->assertContains('--clean', $this->restores[0]);
        $this->assertContains('--single-transaction', $this->restores[0]);
        $this->assertNotContains('-L', $this->restores[0], 'No table is left out, the audit log included.');
    }

    public function test_a_restore_saves_the_audit_entries_made_after_the_copy_in_a_csv_before_replacing_the_database(): void
    {
        $name = $this->copy('2026-11-04-020000');
        AuditLogEntry::factory()->create(['occurred_at' => '2026-11-03 09:00:00', 'action' => 'before.copy']);
        $after = AuditLogEntry::factory()->create([
            'occurred_at' => '2026-11-10 09:00:00', 'action' => 'after.copy', 'user_agent' => '=HYPERLINK("http://evil")',
            'reason' => "Line one\nline, two \"quoted\"",
        ]);
        $csvWhenRestoring = null;
        // The CSV must exist already when pg_restore starts: it is the only place those entries survive.
        $this->whenRestoring = function () use (&$csvWhenRestoring) {
            $csvWhenRestoring = glob("{$this->folder}/audit-after-*.csv");
        };

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        $file = 'audit-after-2026-11-04-020000-restored-2026-11-18-101500.csv';
        $this->assertSame(["{$this->folder}/{$file}"], $csvWhenRestoring);
        $this->assertSame([], glob("{$this->folder}/*.partial"));
        $handle = fopen("{$this->folder}/{$file}", 'rb');
        $rows = [];
        while (($row = fgetcsv($handle, escape: '')) !== false) {
            $rows[] = $row;
        }
        fclose($handle);
        $this->assertSame(['id', 'staff_account_id', 'occurred_at', 'ip_address', 'user_agent', 'action', 'subject_table',
            'subject_id', 'before_values', 'after_values', 'reason', 'created_at', 'updated_at'], $rows[0]);
        $this->assertCount(2, $rows, 'The header and the one entry after the copy.');
        $entry = array_combine($rows[0], $rows[1]);
        $this->assertSame((string) $after->id, $entry['id']);
        $this->assertSame('after.copy', $entry['action']);
        $this->assertSame((string) $after->staff_account_id, $entry['staff_account_id']);
        $this->assertSame('{"status": "active"}', $entry['before_values']);
        $this->assertSame("Line one\nline, two \"quoted\"", $entry['reason']);
        $this->assertSame('\'=HYPERLINK("http://evil")', $entry['user_agent'], 'A formula does not run when the file is opened.');
        $this->assertStringNotContainsString('before.copy', (string) file_get_contents("{$this->folder}/{$file}"));
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('last_restore.audit_csv', $file);
    }

    public function test_the_audit_csv_is_listed_even_when_the_restore_fails_and_is_not_taken_for_a_copy(): void
    {
        $name = $this->copy('2026-11-04-020000');
        $this->failing = ['pg_restore'];

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        $file = 'audit-after-2026-11-04-020000-restored-2026-11-18-101500.csv';
        $this->assertFileExists("{$this->folder}/{$file}");
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('last_restore.audit_csv', $file);
        $this->assertSame([$name], array_column(app(Backups::class)->list(), 'name'));
    }

    public function test_a_restore_signs_everybody_out_and_empties_the_cache(): void
    {
        $name = $this->copy('2026-11-04-020000');
        DB::table('sign_in_sessions')->insert(['id' => 'attacker', 'payload' => 'x', 'last_activity' => time()]);
        DB::table('cache')->insert(['key' => 'k', 'value' => 'v', 'expiration' => time() + 3600]);
        DB::table('cache_locks')->insert(['key' => 'l', 'owner' => 'o', 'expiration' => time() + 3600]);
        Cache::put('in-memory', 'v');
        $member = User::factory()->create(['current_session_id' => 'device']);
        $member->forceFill(['remember_token' => 'remembered-device'])->save();

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        // Members sign in with "remember me": their remember token and current session go too.
        $this->assertNull($member->fresh()->remember_token);
        $this->assertNull($member->fresh()->current_session_id);
        $this->actingAs($member->fresh(), 'web')->withSession(['user_session_id' => 'device'])->fromThePwa()
            ->getJson('/api/user/me')->assertUnauthorized()->assertJsonPath('error.code', 'user_session_replaced');
        $this->assertSame(0, DB::table('sign_in_sessions')->count());
        $this->assertSame(0, DB::table('cache')->count());
        $this->assertSame(0, DB::table('cache_locks')->count());
        $this->assertNull(Cache::get('in-memory'));
        // The result is read from the backup folder, not the database, so it survives the emptying.
        $this->assertSame(
            ['name' => $name, 'ok' => true, 'at' => '2026-11-18T14:15:00.000000Z', 'audit_csv' => 'audit-after-2026-11-04-020000-restored-2026-11-18-101500.csv'],
            app(Backups::class)->state()['last_restore'],
        );
    }

    public function test_a_failed_migration_after_pg_restore_still_signs_everybody_out_and_reports_the_failure(): void
    {
        $name = $this->copy('2026-11-04-020000');
        DB::table('sign_in_sessions')->insert(['id' => 'attacker', 'payload' => 'x', 'last_activity' => time()]);
        $member = User::factory()->create(['current_session_id' => 'device']);
        $member->forceFill(['remember_token' => 'remembered-device'])->save();
        Event::listen(NoPendingMigrations::class, fn () => throw new RuntimeException('simulated migration failure'));

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        $this->assertSame(0, DB::table('sign_in_sessions')->count());
        $this->assertNull($member->fresh()->remember_token);
        $this->assertFalse(app()->isDownForMaintenance(), 'The app comes back up.');
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('last_restore.name', $name)
            ->assertJsonPath('last_restore.ok', false);
    }

    public function test_the_list_says_which_job_runs_and_on_which_copy(): void
    {
        $name = $this->copy('2026-11-04-020000');
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('running_kind', null)->assertJsonPath('running_name', null);

        app(Backups::class)->start('restore', $name);
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('running', true)
            ->assertJsonPath('running_kind', 'restore')->assertJsonPath('running_name', $name);
        app(Backups::class)->finish();

        app(Backups::class)->start('backup');
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('running_kind', 'backup')->assertJsonPath('running_name', null);
    }

    public function test_a_restore_leaves_the_app_in_maintenance_if_it_was_already_there(): void
    {
        $name = $this->copy('2026-11-04-020000');
        Artisan::call('down');
        try {
            app(Backups::class)->restore($name);

            $this->assertTrue(app()->isDownForMaintenance());
        } finally {
            Artisan::call('up');
        }
    }

    public function test_photos_that_cannot_be_moved_in_leave_the_old_photos_where_they_were(): void
    {
        $name = $this->copy('2026-11-04-020000');
        Storage::disk('local')->put('photos/current.jpg', 'a photo');
        // The restored photos vanish after pg_restore, so the rename fails with a warning, which Laravel throws.
        $this->whenRestoring = fn () => File::deleteDirectory(glob(Storage::disk('local')->path('.restore-*'))[0].'/photos');

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        Storage::disk('local')->assertExists('photos/current.jpg');
        $this->assertSame([], glob(Storage::disk('local')->path('.old-*')));
        $this->assertFalse(app()->isDownForMaintenance());
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('last_restore.name', $name)
            ->assertJsonPath('last_restore.ok', false);
    }

    public function test_a_failed_restore_brings_the_app_back_keeps_the_photos_and_reports_it(): void
    {
        $name = $this->copy('2026-11-04-020000');
        Storage::disk('local')->put('photos/current.jpg', 'a photo');
        $this->failing = ['pg_restore'];

        $this->asAdmin()->postJson("/api/staff/backups/{$name}/restore", ['confirmation' => 'RESTAURAR'])->assertStatus(202);

        $this->assertFalse(app()->isDownForMaintenance());
        Storage::disk('local')->assertExists('photos/current.jpg');
        $this->asAdmin()->getJson('/api/staff/backups')->assertJsonPath('last_restore.name', $name)
            ->assertJsonPath('last_restore.ok', false);
        $this->assertSame('backup.restore_failed', AuditLogEntry::query()->sole()->action);
    }

    public function test_the_automatic_backup_runs_only_when_the_last_copy_is_two_weeks_old(): void
    {
        $this->copy('2026-11-05-020000');
        app(Backups::class)->runIfDue(app(AuditLog::class));
        Process::assertNothingRan();

        $this->travelTo('2026-11-19 02:00:00');
        app(Backups::class)->runIfDue(app(AuditLog::class));

        $this->assertCount(2, app(Backups::class)->list());
        $entry = AuditLogEntry::query()->sole();
        $this->assertSame('backup.create', $entry->action);
        $this->assertNull($entry->staff_account_id);
    }
}
