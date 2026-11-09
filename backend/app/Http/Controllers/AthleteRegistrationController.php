<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\User;
use App\Models\WaiverAcceptance;
use App\Services\AthleteLinks;
use App\Services\RegistrationLookup;
use App\Services\RegistrationPhoto;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * The page the athlete's email link opens (diagram 4, REQ-F-15). The account exists only after the final
 * step, which checks the link again, so a link that expires while the form is open creates nothing.
 */
class AthleteRegistrationController extends PaidRegistrationController
{
    public function validateLink(Request $request, AthleteLinks $links): JsonResponse
    {
        $input = $request->validate(['token' => ['required', 'string', 'max:255']]);

        return response()->json(['name' => $links->usable($input['token'])->rosterRecord->name])->header('Cache-Control', 'no-store');
    }

    public function completeAthlete(Request $request, AthleteLinks $links, RegistrationLookup $lookup, RegistrationPhoto $photos): JsonResponse
    {
        $this->requirePrivacy($request);
        $input = $this->validateCompletion($request, ['token' => ['required', 'string', 'max:255']]);
        $record = $links->usable($input['token'])->rosterRecord;
        if ($lookup->emailHasAccount($record->institutional_email)) {
            return response()->json(['state' => 'renewal', 'masked_email' => $lookup->mask($record->institutional_email)]);
        }
        // The original upload never enters storage. No claim or account exists before the JPEG is saved.
        $photo = $photos->save($request->file('photo'));
        try {
            $user = DB::transaction(function () use ($input, $photo, $links, $lookup) {
                // Locked, so two tabs sending the form at once cannot both use the link.
                $link = $links->usable($input['token'], lock: true);
                $record = $link->rosterRecord;
                $term = AcademicTerm::current();
                if ($term === null) {
                    return null;
                }
                if ($lookup->emailHasAccount($record->institutional_email)) {
                    return false;
                }
                $user = User::query()->create(['email' => $record->institutional_email, 'password' => $input['password'], 'locale' => $input['locale']]);
                WaiverAcceptance::query()->create([
                    'user_id' => $user->id, 'full_name' => $record->name, 'email' => $record->institutional_email,
                    'emergency_contact_name' => $input['emergency_contact_name'], 'emergency_contact_phone' => $input['emergency_contact_phone'],
                    'waiver_version' => $input['waiver_version'], 'accepted_at' => now(),
                ]);
                Authorization::query()->create([
                    'user_id' => $user->id, 'academic_term_id' => $term->id, 'type' => 'athlete', 'status' => 'active',
                    'roster_record_id' => $record->id, 'photo_path' => $photo, 'created_account' => true,
                ]);
                $link->forceFill(['used_at' => now()])->save();

                return $user;
            });
        } catch (Throwable $error) {
            $this->discardPhoto($photo);
            if ($error instanceof QueryException && $error->getCode() === '23505') {
                throw new ApiException('roster_record_claimed', 422, ['contact_number' => [$lookup->contactNumber()]]);
            }
            throw $error;
        }
        if (! $user instanceof User) {
            $this->discardPhoto($photo);
            if ($user === false) {
                return response()->json(['state' => 'renewal', 'masked_email' => $lookup->mask($record->institutional_email)]);
            }
            // No current term: there is no term to authorize the athlete for.
            throw new ApiException('conflict', 409);
        }

        return $this->signIn($request, $user);
    }
}
