<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\RosterRecord;
use App\Notifications\AthleteRegistrationLink;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Throwable;

/**
 * The link sent to the roster email proves the athlete owns the record (REQ-F-15). Earlier links are kept,
 * so an older link can say it was replaced, and the kept rows count toward the request limit (E-73).
 */
class AthleteLinks
{
    public function __construct(private RegistrationLookup $lookup) {}

    /** @return array{masked_email: string, resend_in: int} */
    public function send(RosterRecord $record, string $locale): array
    {
        $token = Str::random(64);
        $emailLink = DB::transaction(function () use ($record, $token) {
            // Locked, so two requests at once cannot both pass the limit.
            RosterRecord::query()->lockForUpdate()->findOrFail($record->id);
            $this->ensureBelowLimit($record);

            return EmailLink::query()->create([
                'purpose' => 'athlete_registration',
                'token_hash' => hash('sha256', $token),
                'roster_record_id' => $record->id,
                'expires_at' => now()->addHours(config('registration.athlete_link_hours')),
            ]);
        });
        try {
            Notification::route('mail', $record->institutional_email)->notify(new AthleteRegistrationLink($token, $locale));
        } catch (Throwable $error) {
            // A link that never left must not use up the resend and daily limits.
            $emailLink->delete();
            throw $error;
        }

        return ['masked_email' => $this->lookup->mask($record->institutional_email), 'resend_in' => config('registration.athlete_link_resend_seconds')];
    }

    private function ensureBelowLimit(RosterRecord $record): void
    {
        $sent = EmailLink::query()->where('purpose', 'athlete_registration')->where('roster_record_id', $record->id)
            ->where('created_at', '>', now()->subDay())->orderByDesc('created_at')->pluck('created_at');
        $retryAt = null;
        if ($sent->isNotEmpty() && $sent->first()->gt(now()->subSeconds(config('registration.athlete_link_resend_seconds')))) {
            $retryAt = $sent->first()->copy()->addSeconds(config('registration.athlete_link_resend_seconds'));
        }
        $perDay = config('registration.athlete_links_per_day');
        if ($sent->count() >= $perDay) {
            $dayRetry = $sent[$perDay - 1]->copy()->addDay();
            $retryAt = $retryAt === null ? $dayRetry : $retryAt->max($dayRetry);
        }
        if ($retryAt !== null) {
            throw new ApiException('athlete_link_limit', 429, [], ['Retry-After' => (string) max(1, (int) ceil(now()->diffInSeconds($retryAt)))]);
        }
    }

    /** Checks the link the athlete opened. Every failure creates nothing. */
    public function usable(string $token, bool $lock = false): EmailLink
    {
        $query = EmailLink::query()->where('purpose', 'athlete_registration')->where('token_hash', hash('sha256', $token));
        $link = ($lock ? $query->lockForUpdate() : $query)->first();
        // The final step also locks the roster record, which a withdrawal locks too: the registration either waits
        // for the withdrawal and is refused here, or finishes first and the withdrawal then revokes it (#163).
        $record = $link === null ? null
            : ($lock ? RosterRecord::query()->lockForUpdate()->find($link->roster_record_id) : $link->rosterRecord);
        if ($link === null || $record === null || $record->removed_at !== null) {
            throw new ApiException('athlete_link_invalid', 422);
        }
        if ($link->used_at !== null) {
            throw new ApiException('athlete_link_used', 422);
        }
        if (Authorization::query()->where('roster_record_id', $record->id)->exists()) {
            throw new ApiException('roster_record_claimed', 422, ['contact_number' => [$this->lookup->contactNumber()]]);
        }
        if (EmailLink::query()->where('purpose', 'athlete_registration')->where('roster_record_id', $record->id)->where('id', '>', $link->id)->exists()) {
            throw new ApiException('athlete_link_replaced', 422);
        }
        if ($link->expires_at->lte(now())) {
            throw new ApiException('athlete_link_expired', 422);
        }

        return $link;
    }
}
