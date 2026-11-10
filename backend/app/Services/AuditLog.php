<?php

namespace App\Services;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use LogicException;

/**
 * Writes audit log entries (REQ-NF-39). Gym features call record(); the service fills in
 * who, when, the IP address and the browser, so no feature can forget them.
 */
class AuditLog
{
    public function __construct(private Request $request) {}

    /**
     * An action by the signed-in staff account. Pass $by only when the account is not
     * signed in on this request, for example right before or after a sign-out.
     */
    public function record(
        string $action,
        ?Model $subject = null,
        ?array $before = null,
        ?array $after = null,
        ?string $reason = null,
        ?StaffAccount $by = null,
    ): AuditLogEntry {
        $by ??= Auth::guard('staff')->user();

        if ($by === null) {
            throw new LogicException("Audit action [{$action}] needs a staff account; use recordSystem() for system alerts.");
        }

        return $this->write($action, $subject, $before, $after, $reason, [
            'staff_account_id' => $by->id,
            // The real client IP: TrustProxies reads the proxy header only from trusted proxies.
            'ip_address' => $this->request->ip(),
            'user_agent' => $this->request->userAgent(),
        ]);
    }

    /** An alert raised by the system itself, such as the global lookup limit (REQ-F-71). */
    public function recordSystem(
        string $action,
        ?Model $subject = null,
        ?array $before = null,
        ?array $after = null,
        ?string $reason = null,
    ): AuditLogEntry {
        return $this->write($action, $subject, $before, $after, $reason, [
            'staff_account_id' => null,
            'ip_address' => null,
            'user_agent' => null,
        ]);
    }

    private function write(string $action, ?Model $subject, ?array $before, ?array $after, ?string $reason, array $who): AuditLogEntry
    {
        return AuditLogEntry::query()->create([
            ...$who,
            'occurred_at' => now(),
            'action' => $action,
            'subject_table' => $subject?->getTable(),
            'subject_id' => $subject?->getKey(),
            'before_values' => $before,
            'after_values' => $after,
            'reason' => $reason,
        ]);
    }
}
