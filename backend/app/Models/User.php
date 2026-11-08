<?php

namespace App\Models;

use App\Models\Concerns\SavesDatesInAppTimezone;
use App\Notifications\UserPasswordReset;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/** A gym User. Deleting the account keeps the row with no personal data and deleted_at set (D2). */
#[Fillable(['email', 'password', 'locale', 'current_session_id', 'last_signed_in_at', 'deleted_at'])]
#[Hidden(['password', 'remember_token', 'current_session_id'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, SavesDatesInAppTimezone;

    public function activeAuthorizations(): Builder
    {
        return Authorization::query()->where('user_id', $this->id)->where('status', 'active')
            ->whereHas('academicTerm', fn (Builder $query) => $query->where('ends_on', '>=', today()->toDateString()));
    }

    /** The active authorization of the term that runs today, if any. */
    public function currentAuthorization(): ?Authorization
    {
        return Authorization::query()->select('authorizations.*')
            ->join('academic_terms', 'academic_terms.id', '=', 'authorizations.academic_term_id')
            ->where('authorizations.user_id', $this->id)->where('authorizations.status', 'active')
            ->where('academic_terms.starts_on', '<=', today()->toDateString())
            ->where('academic_terms.ends_on', '>=', today()->toDateString())
            ->orderByDesc('academic_terms.starts_on')->with('academicTerm')->first();
    }

    public function profile(): array
    {
        $authorization = $this->currentAuthorization();
        // Member or athlete comes from the current authorization, or else the latest of any term, so My account shows it with no active one.
        $accountType = Authorization::query()->join('academic_terms', 'academic_terms.id', '=', 'authorizations.academic_term_id')
            ->where('authorizations.user_id', $this->id)->orderByDesc('academic_terms.starts_on')
            ->orderByDesc('authorizations.id')->value('authorizations.type');

        // Only the account's own sign-in and /me send this, so the email is not masked (team, 2026-11-08).
        return [
            'name' => WaiverAcceptance::query()->where('user_id', $this->id)->value('full_name'),
            'email' => $this->email,
            'locale' => $this->locale,
            'account_type' => $authorization?->type ?? $accountType,
            'authorization' => $authorization === null ? null : ['type' => $authorization->type, 'term' => $authorization->academicTerm->name],
            'updated_at' => now()->toISOString(),
        ];
    }

    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new UserPasswordReset($token));
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_signed_in_at' => 'datetime',
            'deleted_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
