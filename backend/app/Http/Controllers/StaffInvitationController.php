<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\EmailLink;
use App\Services\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rules\Password as PasswordRule;

/** The invited person opens the email link and sets their own password (REQ-F-88, N-11). Nobody else sees it. */
class StaffInvitationController extends Controller
{
    public function validateLink(Request $request): JsonResponse
    {
        $input = $request->validate(['token' => ['required', 'string', 'max:255']]);
        $account = $this->usableLink($input['token'])->staffAccount;

        return response()->json($account->only('name', 'email', 'role'));
    }

    public function accept(Request $request, AuditLog $log): Response
    {
        $input = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:255', 'confirmed', PasswordRule::min(10)->uncompromised()],
            'password_confirmation' => ['required', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($input, $log) {
            // Locked, so two tabs sending the form at once cannot both use the link.
            $link = $this->usableLink($input['token'], lock: true);
            $account = $link->staffAccount;
            $account->forceFill(['password' => $input['password']])->save();
            $link->forceFill(['used_at' => now()])->save();
            $log->record('staff.invite_accept', $account, by: $account);
        });

        return response()->noContent();
    }

    /** Unknown, used, expired or for a deactivated account: one answer, so the link says nothing more. */
    private function usableLink(string $token, bool $lock = false): EmailLink
    {
        $query = EmailLink::query()
            ->where('purpose', 'staff_invite')
            ->where('token_hash', hash('sha256', $token))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->whereHas('staffAccount', fn ($q) => $q->whereNull('deactivated_at')->whereNull('password'));

        $link = ($lock ? $query->lockForUpdate() : $query)->first();
        if ($link === null) {
            throw new ApiException('staff_invite_link_invalid', 422);
        }

        return $link;
    }
}
