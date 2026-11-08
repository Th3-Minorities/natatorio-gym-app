<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\RosterRecord;
use App\Services\AuditLog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The athlete roster: one list, entered by hand (REQ-F-49, REQ-F-51, E-116). Administrators add and edit on
 * A-05; Staff read the active athletes, read only (E-59).
 */
class RosterController extends Controller
{
    private const FIELDS = ['name', 'sport', 'student_number', 'institutional_email'];

    public function index(Request $request): JsonResponse
    {
        $input = $request->validate([
            'status' => ['sometimes', 'string', Rule::in(['active', 'withdrawn', 'all'])],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);
        // Staff never see withdrawn athletes, whatever they ask for.
        $status = $request->user('staff')->role === 'admin' ? ($input['status'] ?? 'active') : 'active';

        $athletes = RosterRecord::query()
            ->when($status === 'active', fn (Builder $query) => $query->whereNull('removed_at'))
            ->when($status === 'withdrawn', fn (Builder $query) => $query->whereNotNull('removed_at'))
            ->when(trim((string) ($input['search'] ?? '')) !== '', fn (Builder $query) => $this->search($query, trim($input['search'])))
            ->orderBy('name')->orderBy('id')->get();

        return response()->json([
            'athletes' => $athletes->map(fn (RosterRecord $athlete) => $this->show($athlete))->all(),
            'active_count' => RosterRecord::query()->whereNull('removed_at')->count(),
        ]);
    }

    public function store(Request $request, AuditLog $log): JsonResponse
    {
        $input = $this->validated($request);

        $athlete = $this->saving($input, function () use ($input, $log) {
            $athlete = RosterRecord::query()->create($input);
            $log->record('roster.add', $athlete, null, $this->values($athlete));

            return $athlete;
        });

        return response()->json(['athlete' => $this->show($athlete)], 201);
    }

    public function update(Request $request, RosterRecord $athlete, AuditLog $log): JsonResponse
    {
        $input = $this->validated($request);

        $athlete = $this->saving($input, function () use ($input, $athlete, $log) {
            $before = $this->values($athlete);
            $athlete->fill($input)->save();
            $changed = array_flip(array_keys(array_diff_assoc($this->values($athlete), $before)));
            if ($changed !== []) {
                $log->record('roster.update', $athlete, array_intersect_key($before, $changed),
                    array_intersect_key($this->values($athlete), $changed));
            }

            return $athlete;
        }, $athlete);

        return response()->json(['athlete' => $this->show($athlete)]);
    }

    /** @return array{name: string, sport: string, student_number: string, institutional_email: string} */
    private function validated(Request $request): array
    {
        $input = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sport' => ['required', 'string', 'max:50'],
            // E-160: exactly 9 digits, whatever the first ones are.
            'student_number' => ['required', 'string', 'digits:9'],
            'institutional_email' => ['required', 'string', 'email', 'max:255'],
        ]);
        $input['institutional_email'] = mb_strtolower($input['institutional_email']);

        return $input;
    }

    /** Name in any case, or part of the student number. % and _ are searched as plain text. */
    private function search(Builder $query, string $text): void
    {
        $like = '%'.addcslashes($text, '\\%_').'%';
        $query->where(fn (Builder $query) => $query->where('name', 'ilike', $like)->orWhere('student_number', 'like', $like));
    }

    /**
     * Refuses a student number another athlete has, withdrawn athletes included (one roster, D16), naming
     * that athlete (A-05 "Número repetido"). Two saves at the same moment: the unique index stops the second.
     */
    private function saving(array $input, callable $save, ?RosterRecord $athlete = null): RosterRecord
    {
        $taken = fn () => RosterRecord::query()->where('student_number', $input['student_number'])
            ->when($athlete, fn (Builder $query) => $query->whereKeyNot($athlete->id))->first();

        if ($other = $taken()) {
            throw $this->numberTaken($other);
        }

        try {
            return DB::transaction($save);
        } catch (UniqueConstraintViolationException) {
            throw ($other = $taken()) ? $this->numberTaken($other) : new ApiException('roster_student_number_taken', 422);
        }
    }

    private function numberTaken(RosterRecord $other): ApiException
    {
        return new ApiException('roster_student_number_taken', 422, ['athlete' => ['id' => $other->id, 'name' => $other->name]]);
    }

    /** @return array{name: string, sport: string, student_number: string, institutional_email: string} */
    private function values(RosterRecord $athlete): array
    {
        return $athlete->only(self::FIELDS);
    }

    /** @return array{id: int, name: string, sport: string, student_number: string, institutional_email: string, status: string} */
    private function show(RosterRecord $athlete): array
    {
        return ['id' => $athlete->id, ...$this->values($athlete), 'status' => $athlete->removed_at === null ? 'active' : 'withdrawn'];
    }
}
