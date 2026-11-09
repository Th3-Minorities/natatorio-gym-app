<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Services\FacilitySessions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * S-01's list of who is inside now (Figma 121:2841, REQ-F-44) and the photo Staff compare with the person
 * (REQ-F-45, REQ-NF-19). Staff and Administrators both use it (#26).
 */
class ActiveSessionsController extends Controller
{
    public function __construct(private FacilitySessions $sessions) {}

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate(['search' => ['sometimes', 'nullable', 'string', 'max:255']]);
        $sessions = $this->sessions->inside(now(), trim((string) ($input['search'] ?? '')));

        return response()->json([
            'sessions' => $sessions->map(fn (FacilitySession $session) => [
                'id' => $session->id,
                'started_at' => $session->started_at->toISOString(),
                'name' => $session->getAttribute('full_name'),
                'type' => $this->type($session),
                'sport' => $session->sport,
                'has_photo' => (bool) $session->getAttribute('has_photo'),
            ])->values()->all(),
        ]);
    }

    /** The photo of the authorization the visit used, only while the visit is inside; never cached (REQ-NF-20). */
    public function photo(int $session): StreamedResponse
    {
        $visit = $this->sessions->insideById($session, now());
        $path = $visit?->authorization_id ? Authorization::query()->whereKey($visit->authorization_id)->value('photo_path') : null;
        if (! $path || ! Storage::disk('local')->exists($path)) {
            throw new ApiException('not_found', 404);
        }

        return Storage::disk('local')->response($path, null, ['Cache-Control' => 'private, no-store']);
    }

    /** The chip on each row (121:3066): Atleta, Socio estudiante, Socio empleado or Acceso manual (E-148). */
    private function type(FacilitySession $session): string
    {
        return match ($session->authorization_type) {
            'athlete', 'manual' => $session->authorization_type,
            default => $session->member_group === 'employee' ? 'employee' : 'student',
        };
    }
}
