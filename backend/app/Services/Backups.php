<?php

namespace App\Services;

use App\Exceptions\ApiException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * A-16 backups (#86). A backup is one tar file in config('backups.path') with a pg_dump of the database (one
 * consistent snapshot) and the photos folder. The folder is the list: no table, so a restore never loses it.
 * Its state.json keeps the last failed backup and the last restore result; the "running" file marks a backup or a
 * restore in progress (which one, and the copy's name for a restore), for the app and the scheduler alike.
 */
class Backups
{
    /** The copies kept on the server; older ones are deleted after each new one. */
    public const KEEP = 2;

    /** Automatic backups run every 14 days at this hour, Puerto Rico time. */
    public const EVERY_DAYS = 14;

    public const HOUR = 2;

    /** The pattern of a backup's file name, also the route parameter. */
    public const NAME_PATTERN = 'backup-\d{4}-\d{2}-\d{2}-\d{6}\.tar';

    /** openssl enc's PBKDF2 iterations for the encrypted download. */
    public const ITERATIONS = 600000;

    /** A "running" mark older than this was left by a process that died. */
    private const STALE_HOURS = 6;

    public function folder(): string
    {
        $folder = rtrim(config('backups.path'), '/');
        File::ensureDirectoryExists($folder);

        return $folder;
    }

    /** @return list<array{name: string, created_at: Carbon, size: int}> newest first */
    public function list(): array
    {
        $backups = [];
        foreach (File::files($this->folder()) as $file) {
            if (preg_match('/^backup-(\d{4}-\d{2}-\d{2}-\d{6})\.tar$/', $file->getFilename(), $match)) {
                $backups[] = [
                    'name' => $file->getFilename(),
                    'created_at' => Carbon::createFromFormat('Y-m-d-His', $match[1]),
                    'size' => $file->getSize(),
                ];
            }
        }
        usort($backups, fn ($a, $b) => strcmp($b['name'], $a['name']));

        return $backups;
    }

    /** The full path of a copy on the server, or 404. */
    public function path(string $name): string
    {
        $path = $this->folder().'/'.$name;
        if (! preg_match('/^'.self::NAME_PATTERN.'$/', $name) || ! is_file($path)) {
            throw new ApiException('backup_not_found', 404);
        }

        return $path;
    }

    public function running(): bool
    {
        $mark = $this->folder().'/running';

        return is_file($mark) && filemtime($mark) > time() - self::STALE_HOURS * 3600;
    }

    /**
     * What the "running" mark says runs: a "backup" or a "restore" with the copy's name, or nulls when unreadable.
     *
     * @return array{kind: string|null, name: string|null}
     */
    public function job(): array
    {
        $mark = json_decode((string) @file_get_contents($this->folder().'/running'), true);

        return [
            'kind' => is_array($mark) && is_string($mark['kind'] ?? null) ? $mark['kind'] : null,
            'name' => is_array($mark) && is_string($mark['name'] ?? null) ? $mark['name'] : null,
        ];
    }

    /** Claims the "running" mark for a "backup" or a "restore" of the copy $name, or 409 while another runs. */
    public function start(string $kind, ?string $name = null): void
    {
        $mark = $this->folder().'/running';
        if (is_file($mark) && ! $this->running()) {
            @unlink($mark);
        }
        // 'x' creates the file only if it is not there, in one step, so two requests cannot both start.
        $handle = @fopen($mark, 'x');
        if ($handle === false) {
            throw new ApiException('backup_running', 409);
        }
        fwrite($handle, json_encode(['kind' => $kind, 'name' => $name]));
        fclose($handle);
    }

    public function finish(): void
    {
        @unlink($this->folder().'/running');
    }

    /** @return array{failed_backup_at?: string|null, last_restore?: array{name: string, ok: bool, at: string, audit_csv: string|null}|null} */
    public function state(): array
    {
        $file = $this->folder().'/state.json';

        return is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    }

    private function saveState(array $changes): void
    {
        file_put_contents($this->folder().'/state.json', json_encode([...$this->state(), ...$changes]));
    }

    /** $auditCsv: the file with the audit entries made after the copy, so it can be found (see exportAuditAfter). */
    private function recordRestore(string $name, bool $ok, ?string $auditCsv): void
    {
        $this->saveState(['last_restore' => ['name' => $name, 'ok' => $ok, 'at' => Carbon::now()->toISOString(), 'audit_csv' => $auditCsv]]);
    }

    /** The next automatic backup: 14 days after the day of the last one, at 2:00, and never in the past. */
    public function nextAutomatic(): Carbon
    {
        $now = Carbon::now();
        $soonest = $now->copy()->setTime(self::HOUR, 0);
        if ($soonest->lessThanOrEqualTo($now)) {
            $soonest->addDay();
        }
        $latest = $this->list()[0]['created_at'] ?? null;
        $due = $latest?->copy()->startOfDay()->addDays(self::EVERY_DAYS)->setTime(self::HOUR, 0);

        return $due !== null && $due->greaterThan($soonest) ? $due : $soonest;
    }

    /** The scheduler calls this every day at 2:00; it backs up only when 14 days have passed. */
    public function runIfDue(AuditLog $log): void
    {
        $latest = $this->list()[0]['created_at'] ?? null;
        if ($latest !== null && Carbon::now()->startOfDay()->lessThan($latest->copy()->startOfDay()->addDays(self::EVERY_DAYS))) {
            return;
        }
        try {
            $this->start('backup');
        } catch (ApiException) {
            return;
        }
        try {
            $log->recordSystem('backup.create', after: ['name' => $this->create()]);
        } catch (Throwable $e) {
            report($e);
            $log->recordSystem('backup.failed');
        } finally {
            $this->finish();
        }
    }

    /** Makes a new copy and deletes the ones past KEEP. The caller holds the "running" mark. */
    public function create(): string
    {
        $folder = $this->folder();
        $stamp = Carbon::now()->format('Y-m-d-His');
        $name = "backup-{$stamp}.tar";
        $work = "{$folder}/work-{$stamp}";
        $partial = "{$folder}/{$name}.partial";
        File::ensureDirectoryExists($work);
        Storage::disk('local')->makeDirectory('photos');

        try {
            // pg_dump reads the whole database in one snapshot, so the copy is consistent while the gym works.
            $this->run(['pg_dump', '--format=custom', "--file={$work}/database.dump", ...$this->connection()]);
            $this->run(['tar', '--create', "--file={$partial}", "--directory={$work}", 'database.dump',
                '--directory='.Storage::disk('local')->path(''), 'photos']);
            if (! rename($partial, "{$folder}/{$name}")) {
                throw new RuntimeException('The backup file was not written.');
            }
        } catch (Throwable $e) {
            @unlink($partial);
            $this->saveState(['failed_backup_at' => Carbon::now()->toISOString()]);
            throw $e;
        } finally {
            File::deleteDirectory($work);
        }

        $this->saveState(['failed_backup_at' => null]);
        foreach (array_slice($this->list(), self::KEEP) as $old) {
            @unlink("{$folder}/{$old['name']}");
        }

        return $name;
    }

    /**
     * Replaces the database and the photos with a copy on the server. The app is in maintenance meanwhile and goes
     * back to what it was whatever happens. Before anything changes, the audit entries made after the copy are saved
     * to a CSV in the backup folder (exportAuditAfter), because the restore brings the audit log back to the copy's
     * state like every other table. pg_restore runs in one transaction, so a failed restore leaves the database as it
     * was. Nobody stays signed in: the restored sessions, member remember tokens and cache are emptied right after pg_restore, so after a break-in the attacker's
     * session does not come back with the copy. The result, with the CSV's name, is saved in state.json.
     */
    public function restore(string $name): void
    {
        $path = $this->path($name);
        $stamp = Carbon::now()->format('Y-m-d-His');
        $work = $this->folder()."/restore-{$stamp}";
        $root = rtrim(Storage::disk('local')->path(''), '/');
        // Inside the photos volume, so the new folder moves into place with a rename.
        $incoming = "{$root}/.restore-{$stamp}";
        File::ensureDirectoryExists($work);
        File::ensureDirectoryExists($incoming);

        $auditCsv = null;
        $wasDown = app()->isDownForMaintenance();
        Artisan::call('down');
        try {
            $auditCsv = $this->exportAuditAfter($name, $stamp);
            $this->run(['tar', '--extract', "--file={$path}", "--directory={$work}", 'database.dump']);
            $this->run(['tar', '--extract', "--file={$path}", "--directory={$incoming}", 'photos']);
            File::ensureDirectoryExists("{$incoming}/photos");
            $this->run(['pg_restore', '--clean', '--if-exists', '--no-owner', '--no-privileges', '--single-transaction',
                ...$this->connection(), "{$work}/database.dump"]);
            // Right after pg_restore and before migrate, so a failed migration never leaves restored sessions alive.
            // Members sign in with "remember me", so their remember tokens and current sessions go too.
            DB::table('sign_in_sessions')->delete();
            DB::table('cache')->delete();
            DB::table('cache_locks')->delete();
            DB::table('users')->update(['remember_token' => null, 'current_session_id' => null]);
            Cache::flush();
            // The copy may come from before a migration that has run since.
            if (Artisan::call('migrate', ['--force' => true]) !== 0) {
                throw new RuntimeException('The migrations failed after the restore: '.Artisan::output());
            }

            $this->swapPhotos($root, $incoming, $stamp);
            $this->recordRestore($name, true, $auditCsv);
        } catch (Throwable $e) {
            $this->recordRestore($name, false, $auditCsv);
            throw $e;
        } finally {
            File::deleteDirectory($work);
            File::deleteDirectory($incoming);
            if (! $wasDown) {
                Artisan::call('up');
            }
        }
    }

    /**
     * Writes every audit entry made after the copy to audit-after-<copy stamp>-restored-<now>.csv in the backup
     * folder, with all the columns, and returns the file's name. The restore removes those entries from the database;
     * the file is outside it, so it survives. A cell that starts like a formula gets a leading quote, because the
     * user agent comes from the browser and the file is opened in a spreadsheet.
     */
    private function exportAuditAfter(string $name, string $restoredAt): string
    {
        preg_match('/^backup-(\d{4}-\d{2}-\d{2}-\d{6})\.tar$/', $name, $match);
        $file = "audit-after-{$match[1]}-restored-{$restoredAt}.csv";
        $partial = $this->folder()."/{$file}.partial";
        $copyTime = Carbon::createFromFormat('Y-m-d-His', $match[1]);

        $out = fopen($partial, 'wb');
        try {
            fputcsv($out, Schema::getColumnListing('audit_log_entries'), escape: '');
            foreach (DB::table('audit_log_entries')->where('occurred_at', '>', $copyTime->toIso8601String())->orderBy('id')->cursor() as $row) {
                fputcsv($out, array_map(
                    fn ($cell) => is_string($cell) && preg_match('/^[=+\-@\t\r]/', $cell) ? "'{$cell}" : $cell,
                    (array) $row,
                ), escape: '');
            }
        } finally {
            fclose($out);
        }
        rename($partial, $this->folder()."/{$file}");

        return $file;
    }

    /**
     * Laravel turns the warning of a failed rename into an exception, so there is no false result to test for. The
     * old photos go back to their place when the new ones cannot be moved in.
     */
    private function swapPhotos(string $root, string $incoming, string $stamp): void
    {
        $old = "{$root}/.old-{$stamp}";
        try {
            if (is_dir("{$root}/photos")) {
                rename("{$root}/photos", $old);
            }
            rename("{$incoming}/photos", "{$root}/photos");
        } catch (Throwable $e) {
            if (is_dir($old)) {
                @rename($old, "{$root}/photos");
            }
            throw $e;
        }
        File::deleteDirectory($old);
    }

    /**
     * Writes the copy encrypted with the password, in openssl enc's format, so any server can open it without the
     * app. To decrypt:
     *
     *   openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -md sha256 -in backup-....tar.enc -out backup.tar
     *
     * The password is used here and never stored or logged.
     *
     * @param  resource  $out
     */
    public function writeEncrypted(string $path, string $password, $out): void
    {
        $salt = random_bytes(8);
        $derived = hash_pbkdf2('sha256', $password, $salt, self::ITERATIONS, 48, true);
        $key = substr($derived, 0, 32);
        $iv = substr($derived, 32, 16);
        fwrite($out, 'Salted__'.$salt);

        $in = fopen($path, 'rb');
        $pending = '';
        while (! feof($in)) {
            $pending .= (string) fread($in, 1 << 20);
            // Whole blocks only; the rest waits for the next read or the padded last block. CBC chains on the last block.
            $whole = strlen($pending) - strlen($pending) % 16;
            if ($whole === 0) {
                continue;
            }
            $cipher = openssl_encrypt(substr($pending, 0, $whole), 'aes-256-cbc', $key, OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING, $iv);
            fwrite($out, $cipher);
            $iv = substr($cipher, -16);
            $pending = substr($pending, $whole);
        }
        fclose($in);
        fwrite($out, openssl_encrypt($pending, 'aes-256-cbc', $key, OPENSSL_RAW_DATA, $iv));
    }

    /** @return list<string> */
    private function connection(): array
    {
        $db = config('database.connections.'.config('database.default'));

        return ["--host={$db['host']}", "--port={$db['port']}", "--username={$db['username']}", "--dbname={$db['database']}"];
    }

    /**
     * @param  list<string>  $command
     * @return string what the command printed
     */
    private function run(array $command): string
    {
        $db = config('database.connections.'.config('database.default'));
        $result = Process::env(['PGPASSWORD' => (string) $db['password']])->forever()->run($command);
        if ($result->failed()) {
            throw new RuntimeException("{$command[0]} failed: ".$result->errorOutput());
        }

        return $result->output();
    }
}
