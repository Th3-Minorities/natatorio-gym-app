<?php

namespace App\Http\Controllers;

use App\Models\StaffAccount;
use App\Services\AuditLog;
use App\Services\Backups;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

use function Illuminate\Support\defer;

/**
 * A-16 "Respaldos" (#86), Administrators only. A backup or a restore can take minutes, so both run after the
 * answer is sent; the screen asks index() until "running" is false.
 */
class BackupController extends Controller
{
    public function __construct(private Backups $backups) {}

    public function index(): JsonResponse
    {
        $list = $this->backups->list();
        $state = $this->backups->state();
        $failedAt = $state['failed_backup_at'] ?? null;
        // A failure older than the last good copy is over.
        if ($failedAt !== null && isset($list[0]) && $list[0]['created_at']->greaterThanOrEqualTo($failedAt)) {
            $failedAt = null;
        }

        $running = $this->backups->running();
        $job = $running ? $this->backups->job() : ['kind' => null, 'name' => null];

        return response()->json([
            'running' => $running,
            'running_kind' => $job['kind'],
            'running_name' => $job['name'],
            'backups' => array_map(fn (array $backup) => [
                'name' => $backup['name'],
                'created_at' => $backup['created_at']->toISOString(),
                'size' => $backup['size'],
            ], $list),
            'kept' => Backups::KEEP,
            'next_at' => $this->backups->nextAutomatic()->toISOString(),
            'failed_at' => $failedAt,
            'last_restore' => $state['last_restore'] ?? null,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->backups->start('backup');
        $admin = $request->user('staff');

        defer(function () use ($admin) {
            $this->inBackground(function (AuditLog $log) use ($admin) {
                try {
                    $log->record('backup.create', after: ['name' => $this->backups->create()], by: $admin);
                } catch (Throwable $e) {
                    report($e);
                    $log->record('backup.failed', by: $admin);
                }
            });
        });

        return response()->json(['running' => true], 202);
    }

    public function download(Request $request, string $backup, AuditLog $log): StreamedResponse
    {
        // The same password twice; it only encrypts this download and is never stored.
        $password = $request->validate([
            'password' => ['required', 'string', 'min:10', 'max:200', 'confirmed'],
        ])['password'];
        $path = $this->backups->path($backup);
        $log->record('backup.download', after: ['name' => $backup]);

        return response()->streamDownload(
            fn () => $this->backups->writeEncrypted($path, $password, fopen('php://output', 'wb')),
            "{$backup}.enc",
            ['Content-Type' => 'application/octet-stream', 'Cache-Control' => 'no-store, private'],
        );
    }

    public function restore(Request $request, string $backup): JsonResponse
    {
        $request->validate(['confirmation' => ['required', 'string', 'in:RESTAURAR']]);
        $this->backups->path($backup);
        $this->backups->start('restore', $backup);
        $admin = $request->user('staff');

        defer(function () use ($admin, $backup) {
            $this->inBackground(function (AuditLog $log) use ($admin, $backup) {
                try {
                    // restore() saves its own result in state.json, with the audit CSV's name.
                    $this->backups->restore($backup);
                    $ok = true;
                } catch (Throwable $e) {
                    report($e);
                    $ok = false;
                }
                // After the restore, the account may not exist in the restored data; the entry stays as a system one then.
                $action = $ok ? 'backup.restore' : 'backup.restore_failed';
                StaffAccount::query()->whereKey($admin->id)->exists()
                    ? $log->record($action, after: ['name' => $backup], by: $admin)
                    : $log->recordSystem($action, after: ['name' => $backup, 'staff_account_id' => $admin->id]);
            });
        });

        return response()->json(['running' => true], 202);
    }

    /** Runs after the answer: no time limit, a closed browser does not stop it, and the "running" mark always ends. */
    private function inBackground(callable $work): void
    {
        set_time_limit(0);
        ignore_user_abort(true);
        try {
            app()->call($work);
        } finally {
            $this->backups->finish();
        }
    }
}
