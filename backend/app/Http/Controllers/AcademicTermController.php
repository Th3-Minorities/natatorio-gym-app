<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\AcademicTerm;
use App\Services\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** A-04: the Administrator creates and edits academic terms (REQ-F-21). Terms are never deleted (E-107). */
class AcademicTermController extends Controller
{
    public function index(): JsonResponse
    {
        $terms = AcademicTerm::query()->orderByDesc('starts_on')->get();

        return response()->json(['terms' => $terms->map(fn (AcademicTerm $term) => $this->show($term))->all()]);
    }

    public function store(Request $request, AuditLog $log): JsonResponse
    {
        $input = $this->validated($request);

        $term = $this->saving(function () use ($input, $log) {
            $this->refuseOverlap($input);
            $term = AcademicTerm::query()->create($input);
            $log->record('term.create', $term, null, $this->values($term));

            return $term;
        });

        return response()->json(['term' => $this->show($term)], 201);
    }

    public function update(Request $request, AcademicTerm $term, AuditLog $log): JsonResponse
    {
        $input = $this->validated($request);

        $term = $this->saving(function () use ($input, $term, $log) {
            $this->refuseOverlap($input, $term);
            $before = $this->values($term);
            $term->fill($input)->save();
            // Only what changed. Authorizations keep their term, so a new end date applies to them (E-88).
            $changed = array_keys(array_diff_assoc($this->values($term), $before));
            if ($changed !== []) {
                $log->record('term.update', $term, array_intersect_key($before, array_flip($changed)),
                    array_intersect_key($this->values($term), array_flip($changed)));
            }

            return $term;
        });

        return response()->json(['term' => $this->show($term)]);
    }

    /** @return array{name: string, starts_on: string, ends_on: string} */
    private function validated(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'starts_on' => ['bail', 'required', 'string', 'date_format:Y-m-d'],
            'ends_on' => ['bail', 'required', 'string', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
        ]);
    }

    /** The other term the dates touch, both ends included, as the database constraint counts them. */
    private function refuseOverlap(array $input, ?AcademicTerm $term = null): void
    {
        $other = AcademicTerm::query()
            ->where('starts_on', '<=', $input['ends_on'])->where('ends_on', '>=', $input['starts_on'])
            ->when($term, fn ($query) => $query->whereKeyNot($term->id))
            ->orderBy('starts_on')->first();

        if ($other !== null) {
            throw new ApiException('term_overlap', 422, ['term' => $this->values($other)]);
        }
    }

    /**
     * Runs the save in a transaction. Two saves at the same moment can both pass the check above; the
     * exclusion constraint then refuses the second one, which gets the same answer.
     */
    private function saving(callable $save): AcademicTerm
    {
        try {
            return DB::transaction($save);
        } catch (QueryException $e) {
            if ($e->getCode() !== '23P01') {
                throw $e;
            }
            throw new ApiException('term_overlap', 422);
        }
    }

    /** @return array{name: string, starts_on: string, ends_on: string} */
    private function values(AcademicTerm $term): array
    {
        return [
            'name' => $term->name,
            'starts_on' => $term->starts_on->toDateString(),
            'ends_on' => $term->ends_on->toDateString(),
        ];
    }

    /** @return array{id: int, name: string, starts_on: string, ends_on: string, status: string} */
    private function show(AcademicTerm $term): array
    {
        $today = today();

        return ['id' => $term->id, ...$this->values($term), 'status' => match (true) {
            $term->starts_on->gt($today) => 'upcoming',
            $term->ends_on->lt($today) => 'past',
            default => 'active',
        }];
    }
}
