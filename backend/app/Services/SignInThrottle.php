<?php

namespace App\Services;

use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Cache;

/**
 * Failed sign-in counters per email and per IP (REQ-F-07). After 10 failures that email or IP
 * waits, and each new lockout waits longer. Counters live in the cache table and expire on
 * their own, so nothing personal stays once the wait ends (E-91).
 */
class SignInThrottle
{
    private const MAX_FAILURES = 10;

    /** Seconds to wait after the 1st, 2nd, 3rd and every later lockout. */
    private const WAITS = [60, 300, 900, 3600];

    /** Failures older than this start again from zero. */
    private const FAILURE_WINDOW = 3600;

    /** The lockout number, which makes the next wait longer, is forgotten a day after the last one. */
    private const LOCKOUT_MEMORY = 86400;

    /** @param  string  $prefix  keeps staff and User counters apart, for example "staff-sign-in" */
    public function __construct(private string $prefix) {}

    /** Refuses with 429 and Retry-After while the email or the IP waits. */
    public function ensureNotLocked(string $email, ?string $ip): void
    {
        $wait = max(array_map($this->secondsLeft(...), $this->subjects($email, $ip)));

        if ($wait > 0) {
            throw new ThrottleRequestsException(headers: ['Retry-After' => $wait]);
        }
    }

    public function recordFailure(string $email, ?string $ip): void
    {
        foreach ($this->subjects($email, $ip) as $subject) {
            Cache::add($this->key('failures', $subject), 0, self::FAILURE_WINDOW);

            if (Cache::increment($this->key('failures', $subject)) >= self::MAX_FAILURES) {
                $this->lock($subject);
            }
        }
    }

    /** A right password starts the email again from zero. The IP keeps its count. */
    public function clearAccount(string $email): void
    {
        Cache::forget($this->key('failures', $this->emailSubject($email)));
    }

    private function lock(string $subject): void
    {
        $lockouts = (int) Cache::get($this->key('lockouts', $subject), 0);
        $wait = self::WAITS[min($lockouts, count(self::WAITS) - 1)];

        Cache::put($this->key('locked_until', $subject), now()->getTimestamp() + $wait, $wait);
        Cache::put($this->key('lockouts', $subject), $lockouts + 1, self::LOCKOUT_MEMORY);
        Cache::forget($this->key('failures', $subject));
    }

    private function secondsLeft(string $subject): int
    {
        $until = Cache::get($this->key('locked_until', $subject));

        return $until === null ? 0 : max(0, (int) $until - now()->getTimestamp());
    }

    /** @return list<string> */
    private function subjects(string $email, ?string $ip): array
    {
        return array_values(array_filter([$this->emailSubject($email), $ip === null ? null : "ip:{$ip}"]));
    }

    private function emailSubject(string $email): string
    {
        // Hashed so a long email still fits the cache key; the case is ignored like at sign-in.
        return 'email:'.hash('sha256', mb_strtolower(trim($email)));
    }

    private function key(string $counter, string $subject): string
    {
        return "{$this->prefix}:{$counter}:{$subject}";
    }
}
