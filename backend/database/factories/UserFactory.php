<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'locale' => 'es',
        ];
    }

    /** An account the User deleted: no personal data left (decision D2). */
    public function deleted(): static
    {
        return $this->state(fn () => [
            'email' => null,
            'password' => null,
            'current_session_id' => null,
            'deleted_at' => now(),
        ]);
    }
}
