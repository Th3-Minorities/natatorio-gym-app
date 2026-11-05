<?php

namespace Database\Factories;

use App\Models\Import;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Import>
 */
class ImportFactory extends Factory
{
    public function definition(): array
    {
        return [
            'file_name' => 'orders-'.fake()->date('Y-m-d').'.csv',
            'created_count' => 0,
            'updated_count' => 0,
            'rejected_count' => 0,
            'result' => ['skipped' => []],
        ];
    }
}
