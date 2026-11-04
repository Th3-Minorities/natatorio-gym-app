<?php

namespace Database\Factories;

use App\Models\StaffAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * Front desk Staff by default; admin() for an Administrator.
 *
 * @extends Factory<StaffAccount>
 */
class StaffAccountFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->userName().'@example.com',
            'password' => static::$password ??= Hash::make('password'),
            'role' => 'staff',
            'locale' => 'es',
        ];
    }

    public function admin(): static
    {
        return $this->state(fn () => ['role' => 'admin']);
    }
}
