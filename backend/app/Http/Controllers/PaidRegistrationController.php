<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\ImportedMembership;
use App\Models\Setting;
use App\Models\User;
use App\Models\WaiverAcceptance;
use App\Services\RegistrationLookup;
use App\Services\RegistrationPhoto;
use App\Services\UserPhotoCleanup;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Throwable;

class PaidRegistrationController extends Controller
{
    public function privacy(Request $request): JsonResponse
    {
        $version = config('registration.privacy_version');
        $request->session()->put('registration_privacy_shown', $version);
        $url = Setting::query()->where('name', 'store_url')->value('value');
        $currentTerm = AcademicTerm::query()->where('starts_on', '<=', today())->where('ends_on', '>=', today())->exists();

        return response()->json([
            'version' => $version, 'draft' => $version === 'draft',
            'store_url' => $currentTerm && is_string($url) && filter_var($url, FILTER_VALIDATE_URL)
                && in_array(strtolower(parse_url($url, PHP_URL_SCHEME) ?? ''), ['https', 'http'], true) ? $url : null,
        ])->header('Cache-Control', 'no-store');
    }

    public function acknowledge(Request $request): Response
    {
        $input = $request->validate(['version' => ['required', 'string', Rule::in([config('registration.privacy_version')])]]);
        if ($request->session()->get('registration_privacy_shown') !== $input['version']) {
            throw new ApiException('registration_privacy_required', 403);
        }
        $request->session()->put('registration_privacy_accepted', $input['version']);

        return response()->noContent();
    }

    private function requirePrivacy(Request $request): void
    {
        if ($request->session()->get('registration_privacy_accepted') !== config('registration.privacy_version')) {
            throw new ApiException('registration_privacy_required', 403);
        }
    }

    public function lookup(Request $request, RegistrationLookup $lookup): JsonResponse
    {
        $this->requirePrivacy($request);
        $input = $request->validate(['authorization_number' => ['required', 'string']]);

        return response()->json($lookup->result($lookup->find($input['authorization_number'], $request)))->header('Cache-Control', 'no-store');
    }

    public function waiver(Request $request): JsonResponse
    {
        $this->requirePrivacy($request);
        $input = $request->validate(['locale' => ['required', Rule::in(['es', 'en'])]]);
        $text = config('registration.waiver.'.$input['locale']);
        if (! config('registration.waiver.version') || ! is_string($text) || trim($text) === '') {
            throw new ApiException('registration_waiver_unavailable', 503);
        }

        return response()->json(['version' => config('registration.waiver.version'), 'text' => $text]);
    }

    public function complete(Request $request, RegistrationLookup $lookup, RegistrationPhoto $photos): JsonResponse
    {
        $this->requirePrivacy($request);
        $input = $request->validate([
            'authorization_number' => ['required', 'string'],
            'password' => ['required', 'string', 'max:255', 'confirmed', Password::min(10)->uncompromised()],
            'password_confirmation' => ['required', 'string', 'max:255'],
            'photo' => [
                'bail', 'required', 'file', 'max:10240',
                function (string $attribute, $value, \Closure $fail): void {
                    $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($value->getPathname());
                    if (! in_array($mime, ['image/jpeg', 'image/png', 'image/heic', 'image/heif'], true)
                        || (in_array($mime, ['image/jpeg', 'image/png'], true) && @getimagesize($value->getPathname()) === false)) {
                        $fail('validation.image')->translate();
                    }
                },
            ],
            'waiver_accepted' => ['required', 'accepted'],
            'waiver_version' => ['required', 'string', Rule::in([config('registration.waiver.version')])],
            'emergency_contact_name' => ['required', 'string', 'max:255'],
            'emergency_contact_phone' => ['required', 'string', 'max:30', 'regex:/^\+?[0-9() .-]{7,30}$/', 'regex:/[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9].*[0-9]/'],
            'locale' => ['required', Rule::in(['es', 'en'])],
        ]);
        if (! config('registration.waiver.version') || ! config('registration.waiver.'.$input['locale'])) {
            throw new ApiException('registration_waiver_unavailable', 503);
        }
        $membership = $lookup->find($input['authorization_number'], $request);
        if ($lookup->hasAccount($membership)) {
            return response()->json($lookup->result($membership));
        }
        // The original upload never enters storage. No claim or account exists before the JPEG is saved.
        $photo = $photos->save($request->file('photo'));
        try {
            $user = DB::transaction(function () use ($membership, $input, $photo, $lookup) {
                $membership = ImportedMembership::query()->lockForUpdate()->findOrFail($membership->id);
                $term = AcademicTerm::query()->lockForUpdate()->findOrFail($membership->academic_term_id);
                $membership->setRelation('academicTerm', $term);
                if (! $lookup->available($membership)) {
                    return null;
                }
                if ($lookup->hasAccount($membership)) {
                    return false;
                }
                $user = User::query()->create(['email' => $membership->email, 'password' => $input['password'], 'locale' => $input['locale']]);
                WaiverAcceptance::query()->create([
                    'user_id' => $user->id, 'full_name' => $membership->name, 'email' => $membership->email,
                    'emergency_contact_name' => $input['emergency_contact_name'], 'emergency_contact_phone' => $input['emergency_contact_phone'],
                    'waiver_version' => $input['waiver_version'], 'accepted_at' => now(),
                ]);
                Authorization::query()->create([
                    'user_id' => $user->id, 'academic_term_id' => $membership->academic_term_id, 'type' => 'paid', 'status' => 'active',
                    'imported_membership_id' => $membership->id, 'photo_path' => $photo, 'created_account' => true,
                ]);

                return $user;
            });
        } catch (Throwable $error) {
            $this->discardPhoto($photo);
            if ($error instanceof QueryException && $error->getCode() === '23505') {
                throw $lookup->failed($request);
            }
            throw $error;
        }
        if (! $user instanceof User) {
            $this->discardPhoto($photo);
            if ($user === false) {
                return response()->json($lookup->result($membership));
            }
            throw $lookup->failed($request);
        }

        // Start the same single-device User session as sign-in, after the account transaction committed.
        $user->forceFill(['remember_token' => Str::random(60)])->save();
        Auth::guard('web')->login($user, remember: true);
        $request->session()->regenerate();
        $user->forceFill(['current_session_id' => $request->session()->getId(), 'last_signed_in_at' => now()])->save();
        $request->session()->put('user_session_id', $user->current_session_id);
        $request->session()->forget(['registration_privacy_shown', 'registration_privacy_accepted']);

        return response()->json($user->profile(), 201);
    }

    private function discardPhoto(string $path): void
    {
        DB::table('pending_photo_deletions')->insert(['path' => $path]);
        app(UserPhotoCleanup::class)->deletePending([$path]);
    }
}
