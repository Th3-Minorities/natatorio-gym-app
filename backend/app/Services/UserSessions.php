<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class UserSessions
{
    public function revoke(User $user, ?string $except = null): void
    {
        $webKey = Auth::guard('web')->getName();
        $staffKey = Auth::guard('staff')->getName();
        $sessions = DB::table(config('session.table'))->where('user_id', $user->id);
        if ($except !== null) {
            $sessions->where('id', '<>', $except);
        }
        foreach ($sessions->lockForUpdate()->get() as $session) {
            $data = json_decode(base64_decode($session->payload), true);
            if (is_array($data) && isset($data[$staffKey])) {
                // A student employee can have both accounts in one browser. End only their User access.
                unset($data[$webKey], $data['user_session_id'], $data['password_hash_web']);
                DB::table(config('session.table'))->where('id', $session->id)->update([
                    'user_id' => null, 'payload' => base64_encode(json_encode($data, JSON_THROW_ON_ERROR)),
                ]);
            } else {
                DB::table(config('session.table'))->where('id', $session->id)->delete();
            }
        }
    }
}
