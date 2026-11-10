<?php

namespace App\Services;

use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\RosterRecord;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * The person as Staff see them on S-02 and S-03 (#26): photo, authorization, waiver acceptance and, on S-02 only, the
 * emergency contact, and no other sensitive data (REQ-NF-19). The student number shows in full; no email is sent.
 */
class StaffPeople
{
    /** Most people a name search answers with, so the list stays short (Figma 4288:1573). */
    private const MAX_MATCHES = 10;

    public function __construct(private FacilitySessions $sessions) {}

    /**
     * An athlete by the 9-digit student number (E-160), or anyone registered by part of the name (REQ-F-46).
     * A roster record nobody claimed has no account to enter with, so it is not found.
     *
     * @return Collection<int, User>
     */
    public function search(string $text): Collection
    {
        if (preg_match('/^\d{9}$/D', $text)) {
            $userIds = Authorization::query()->whereIn('roster_record_id',
                RosterRecord::query()->where('student_number', $text)->select('id')
            )->distinct()->limit(self::MAX_MATCHES)->pluck('user_id');

            return User::query()->whereIn('id', $userIds)->get();
        }

        $userIds = WaiverAcceptance::query()->where('full_name', 'ilike', '%'.addcslashes($text, '%_\\').'%')
            ->orderBy('full_name')->limit(self::MAX_MATCHES)->pluck('user_id');

        return User::query()->whereIn('id', $userIds)->get()->sortBy(fn (User $user) => $userIds->search($user->id))->values();
    }

    /**
     * The person block. $authorization is the one to describe, like the one a visit used; otherwise the current one,
     * or else the latest, so a person with no current authorization still shows what they had.
     *
     * @return array<string, mixed>
     */
    public function person(User $user, ?Authorization $authorization = null, bool $emergencyContact = false): array
    {
        $current = $user->currentAuthorization();
        $authorization ??= $current ?? $this->latest($user);

        return $this->describe(
            $user, $current, $authorization,
            WaiverAcceptance::query()->where('user_id', $user->id)->first(), $this->sessions->activeFor($user), $emergencyContact,
        );
    }

    /**
     * The person block for several people, from a fixed number of queries however many there are (S-03 search).
     *
     * @param  Collection<int, User>  $users
     * @return list<array<string, mixed>>
     */
    public function people(Collection $users): array
    {
        $ids = $users->pluck('id');
        $today = today()->toDateString();
        $relations = ['academicTerm', 'rosterRecord', 'importedMembership'];

        // Both lists are newest term first, so the first row of each person is the one person() would pick.
        $current = Authorization::query()->select('authorizations.*')
            ->join('academic_terms', 'academic_terms.id', '=', 'authorizations.academic_term_id')
            ->whereIn('authorizations.user_id', $ids->all())->where('authorizations.status', 'active')
            ->where('academic_terms.starts_on', '<=', $today)->where('academic_terms.ends_on', '>=', $today)
            ->orderByDesc('academic_terms.starts_on')->with($relations)->get()->unique('user_id')->keyBy('user_id');
        $latest = Authorization::query()->select('authorizations.*')
            ->join('academic_terms', 'academic_terms.id', '=', 'authorizations.academic_term_id')
            ->whereIn('authorizations.user_id', $ids->diff($current->keys())->all())
            ->orderByDesc('academic_terms.starts_on')->orderByDesc('authorizations.id')->with($relations)->get()->unique('user_id')->keyBy('user_id');
        $waivers = WaiverAcceptance::query()->whereIn('user_id', $ids->all())->get()->unique('user_id')->keyBy('user_id');
        $active = $this->sessions->activeForMany($ids);

        return $users->map(fn (User $user) => $this->describe(
            $user, $current[$user->id] ?? null, $current[$user->id] ?? $latest[$user->id] ?? null,
            $waivers[$user->id] ?? null, $active[$user->id] ?? null, false,
        ))->values()->all();
    }

    /** @return array<string, mixed> */
    private function describe(User $user, ?Authorization $current, ?Authorization $authorization, ?WaiverAcceptance $waiver, ?FacilitySession $active, bool $emergencyContact): array
    {
        return [
            'user_id' => $user->id,
            'name' => $waiver?->full_name,
            'student_number' => $authorization?->type === 'athlete' ? $authorization->rosterRecord?->student_number : null,
            'type' => $authorization ? self::type($authorization->type, CheckIns::memberGroup($authorization)) : null,
            'sport' => $authorization?->type === 'athlete' ? $authorization->rosterRecord?->sport : null,
            'authorization' => [
                'current' => $current !== null,
                'term' => $authorization?->academicTerm?->name,
            ],
            'waiver' => $waiver ? ['accepted_at' => $waiver->accepted_at->toISOString(), 'version' => $waiver->waiver_version] : null,
            ...($emergencyContact ? ['emergency_contact' => $waiver
                ? ['name' => $waiver->emergency_contact_name, 'phone' => $waiver->emergency_contact_phone]
                : null] : []),
            'photo_pending' => $current?->photo_pending_at !== null,
            'has_photo' => $current?->photo_path !== null,
            'active_session' => $active ? ['id' => $active->id, 'started_at' => $active->started_at->toISOString()] : null,
        ];
    }

    /** The chip Figma draws (121:3066): Atleta, Socio estudiante, Socio empleado or Acceso manual (E-148). */
    public static function type(string $authorizationType, ?string $memberGroup): string
    {
        return match ($authorizationType) {
            'athlete', 'manual' => $authorizationType,
            default => $memberGroup === 'employee' ? 'employee' : 'student',
        };
    }

    /** "p***n@example.com": the first and last letter before the @, as registration masks it (E-72, E-81). */
    public static function mask(?string $email): ?string
    {
        if ($email === null || ! str_contains($email, '@')) {
            return null;
        }
        [$local, $domain] = explode('@', $email, 2);

        return Str::substr($local, 0, 1).'***'.(Str::length($local) > 1 ? Str::substr($local, -1) : '').'@'.$domain;
    }

    private function latest(User $user): ?Authorization
    {
        return Authorization::query()->select('authorizations.*')
            ->join('academic_terms', 'academic_terms.id', '=', 'authorizations.academic_term_id')
            ->where('authorizations.user_id', $user->id)
            ->orderByDesc('academic_terms.starts_on')->orderByDesc('authorizations.id')->first();
    }
}
