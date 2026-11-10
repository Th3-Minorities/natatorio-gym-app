<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\ImportedMembership;
use App\Models\RosterRecord;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class RegistrationLookup
{
    public function __construct(private MembershipStore $store, private AuditLog $audit) {}

    private function ipKey(string $ip): string
    {
        $packed = inet_pton($ip);
        // IPv6 clients share a /64 limit, including privacy addresses.
        $address = $packed !== false && strlen($packed) === 16 ? bin2hex(substr($packed, 0, 8)) : $ip;

        return 'registration:ip:'.hash('sha256', $address);
    }

    public function ensureAllowed(Request $request): void
    {
        $key = $this->ipKey($request->ip());
        $hits = $this->reserve($key, config('registration.window_seconds'));
        if ($hits > config('registration.ip_failures')) {
            $wait = RateLimiter::availableIn($key);
            throw new ThrottleRequestsException('Too many attempts.', null, ['Retry-After' => (string) max(1, $wait)]);
        }
        if (RateLimiter::tooManyAttempts('registration:global', config('registration.global_failures'))) {
            usleep(config('registration.slow_milliseconds') * 1000);
        }
    }

    /**
     * RateLimiter::increment() resets the counter to 1 when two first requests
     * race on a shared store, which admits more lookups than the limit.
     * Same keys as the limiter, so availableIn() and decrement() still work.
     */
    private function reserve(string $key, int $window): int
    {
        $cache = Cache::driver(config('cache.limiter'));
        $key = RateLimiter::cleanRateLimiterKey($key);
        $cache->add($key.':timer', now()->addSeconds($window)->getTimestamp(), $window);
        $cache->add($key, 0, $window);

        return (int) $cache->increment($key);
    }

    public function failed(Request $request, string $code = 'registration_number_unavailable'): ApiException
    {
        $window = config('registration.window_seconds');
        RateLimiter::hit('registration:global', $window);
        if (RateLimiter::tooManyAttempts('registration:global', config('registration.global_failures'))
            && Cache::add('registration:slow-alert', true, $window)) {
            $this->audit->recordSystem('registration_lookup_slow_mode', after: [
                'failure_count' => RateLimiter::attempts('registration:global'),
                'window_seconds' => $window,
            ]);
        }

        $errors = ['contact_number' => [$this->contactNumber()]];

        return match ($code) {
            'student_not_on_roster' => new ApiException('student_not_on_roster', 422, $errors),
            'roster_record_claimed' => new ApiException('roster_record_claimed', 422, $errors),
            default => new ApiException('registration_number_unavailable', 422, $errors),
        };
    }

    public function contactNumber(): string
    {
        return (string) (Setting::query()->where('name', 'contact_phone')->value('value') ?? '265-3866');
    }

    public function find(string $number, Request $request): ImportedMembership
    {
        $number = Str::upper($number);
        $this->ensureAllowed($request);
        $membership = ImportedMembership::query()->whereRaw('upper(authorization_number) = ?', [$number])->first();
        if ($membership === null) {
            $membership = $this->store->find($number);
        }
        if ($membership === null || ! $membership->exists || Str::upper($membership->authorization_number) !== $number || ! $this->available($membership)) {
            throw $this->failed($request);
        }
        RateLimiter::decrement($this->ipKey($request->ip()), config('registration.window_seconds'));

        return $membership;
    }

    /** A 9-digit number is a student number: the athlete must be on the roster; a claimed record is refused unless the roster email already has an account (REQ-F-15, E-70). */
    public function findStudent(string $number, Request $request): RosterRecord
    {
        $this->ensureAllowed($request);
        $record = RosterRecord::query()->where('student_number', $number)->whereNull('removed_at')->first();
        if ($record === null) {
            throw $this->failed($request, 'student_not_on_roster');
        }
        if (! $this->emailHasAccount($record->institutional_email)
            && Authorization::query()->where('roster_record_id', $record->id)->exists()) {
            throw $this->failed($request, 'roster_record_claimed');
        }
        RateLimiter::decrement($this->ipKey($request->ip()), config('registration.window_seconds'));

        return $record;
    }

    public function available(ImportedMembership $membership): bool
    {
        $term = $membership->academicTerm;

        return $membership->order_status === 'completed'
            && $term !== null && $term->starts_on->lte(today()) && $term->ends_on->gte(today())
            && $membership->paid_at->betweenIncluded($term->starts_on->startOfDay(), $term->ends_on->endOfDay())
            && ! Authorization::query()->where('imported_membership_id', $membership->id)->exists();
    }

    public function hasAccount(ImportedMembership $membership): bool
    {
        return $this->emailHasAccount($membership->email);
    }

    public function result(ImportedMembership $membership): array
    {
        $state = $this->hasAccount($membership) ? 'renewal' : 'ready';

        return [
            'state' => $state,
            ...($state === 'ready' ? ['name' => $membership->name] : []),
            'masked_email' => $this->mask($membership->email),
        ];
    }

    /** First and last letter before the @ (E-72), for example m***z@upr.edu. */
    public function mask(string $email): string
    {
        [$local, $domain] = explode('@', $email, 2);

        return Str::substr($local, 0, 1).'***'.(Str::length($local) > 1 ? Str::substr($local, -1) : '').'@'.$domain;
    }

    public function emailHasAccount(string $email): bool
    {
        return User::query()->whereRaw('lower(email) = lower(?)', [$email])->exists();
    }
}
