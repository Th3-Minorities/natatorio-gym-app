<?php

namespace Database\Factories;

use App\Models\StaffAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<StaffAccount>
 */
class StaffAccountFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        $person = FakePerson::make();

        return [
            'name' => $person['name'],
            'email' => $person['email'],
            'password' => static::$password ??= Hash::make('password'),
            'role' => 'staff',
            'locale' => 'es',
        ];
    }

    public function admin(): static
    {
        return $this->state(['role' => 'admin']);
    }

    public function deactivated(): static
    {
        return $this->state(fn () => ['deactivated_at' => now()]);
    }
}
