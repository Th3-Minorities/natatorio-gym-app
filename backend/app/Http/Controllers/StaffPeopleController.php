<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\User;
use App\Services\AuditLog;
use App\Services\CheckIns;
use App\Services\FacilitySessions;
use App\Services\StaffPeople;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * S-03 "Buscar persona y Check in asistido" (Figma 4283:1011, REQ-F-46) and the photo-pending mark Staff set from S-02
 * or S-03 (REQ-F-94), for Staff and Administrators (#26).
 */
class StaffPeopleController extends Controller
{
    public function __construct(private StaffPeople $people) {}

    /** An athlete by student number, or anyone registered by part of the name (4288:1573). */
    public function search(Request $request): JsonResponse
    {
        $input = $request->validate(['search' => ['required', 'string', 'max:255']]);

        return response()->json([
            'people' => $this->people->search(trim($input['search']))
                // Two people can share a name: the masked email tells them apart (E-72, Figma 4288:1573).
                ->map(fn (User $user) => [...$this->people->person($user), 'masked_email' => StaffPeople::mask($user->email)])
                ->values()->all(),
        ]);
    }

    /** The photo of the current authorization, for Staff to compare with the person; never cached (REQ-NF-20). */
    public function photo(int $user): StreamedResponse
    {
        $path = User::query()->find($user)?->currentAuthorization()?->photo_path;
        if (! $path || ! Storage::disk('local')->exists($path)) {
            throw new ApiException('not_found', 404);
        }

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store']);
    }

    /**
     * "Marcar foto pendiente" (122:3094, 4288:2028): Check In and assisted Check In stop until the person uploads a
     * new photo from their phone (REQ-F-94). An open visit stays open. Logged, since it blocks the person's access.
     */
    public function photoPending(Request $request, int $user, AuditLog $log): JsonResponse
    {
        $person = User::query()->find($user) ?? throw new ApiException('not_found', 404);

        DB::transaction(function () use ($person, $request, $log) {
            $authorization = $person->currentAuthorization() ?? throw new ApiException('check_in_no_authorization', 409);
            $authorization = $authorization->newQuery()->whereKey($authorization->id)->lockForUpdate()->firstOrFail();
            if ($authorization->photo_pending_at === null) {
                $authorization->update(['photo_pending_at' => now()]);
                $log->record('photo.pending', $authorization, null, null, null, $request->user('staff'));
            }
        });

        return response()->json(['person' => $this->people->person($person->fresh())]);
    }

    /**
     * Staff-assisted Check In (4288:1920): the same rules as the person's own Check In, without the location, never a
     * second visit, and logged as an exception (REQ-F-46, REQ-NF-39).
     */
    public function checkIn(Request $request, CheckIns $checkIns, FacilitySessions $sessions, AuditLog $log): JsonResponse
    {
        $input = $request->validate(['user_id' => ['required', 'integer', 'min:1']]);
        $person = User::query()->find($input['user_id']) ?? throw new ApiException('not_found', 404);
        $staff = $request->user('staff');

        // Staff see the open visit instead of a second one (4288:1695).
        if ($open = $sessions->activeFor($person)) {
            throw $this->alreadyInside($open->id, $open->started_at->toISOString());
        }
        // The visit and its log entry are saved together, or neither is.
        $session = DB::transaction(function () use ($checkIns, $person, $staff, $log) {
            [$session, $created] = $checkIns->start($person, $staff);
            if (! $created) {
                throw $this->alreadyInside($session->id, $session->started_at->toISOString());
            }
            $log->record('check_in.assisted', $session, null, null, null, $staff);

            return $session;
        });

        return response()->json(['session' => $sessions->data($session)], 201);
    }

    private function alreadyInside(int $id, string $startedAt): ApiException
    {
        return new ApiException('check_in_session_active', 409, ['session' => ['id' => $id, 'started_at' => $startedAt]]);
    }
}
