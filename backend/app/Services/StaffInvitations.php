<?php

namespace App\Services;

use App\Models\EmailLink;
use App\Models\StaffAccount;
use App\Notifications\StaffInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Sends the single-use link that lets an invited person set their own password (REQ-F-88). */
class StaffInvitations
{
    public const DAYS_VALID = 7;

    /** Replaces any earlier link, so only the newest email works. */
    public function send(StaffAccount $account): void
    {
        $token = Str::random(64);

        DB::transaction(function () use ($account, $token) {
            EmailLink::query()->where('purpose', 'staff_invite')->where('staff_account_id', $account->id)->delete();
            EmailLink::query()->create([
                'purpose' => 'staff_invite',
                // Only the hash is stored, so a copy of the database cannot open an invitation (D9).
                'token_hash' => hash('sha256', $token),
                'staff_account_id' => $account->id,
                'expires_at' => now()->addDays(self::DAYS_VALID),
            ]);
        });

        $account->notify(new StaffInvitation($token));
    }
}
