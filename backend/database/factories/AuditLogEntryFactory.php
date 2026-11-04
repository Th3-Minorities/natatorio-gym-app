<?php

namespace Database\Factories;

use App\Models\AuditLogEntry;
use App\Models\StaffAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditLogEntry>
 */
class AuditLogEntryFactory extends Factory
{
    public function definition(): array
    {
        return [
            'staff_account_id' => StaffAccount::factory(),
            'occurred_at' => now(),
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'action' => 'notice_created',
            'subject_table' => 'notices',
            'subject_id' => fake()->numberBetween(1, 100),
            'before_values' => null,
            'after_values' => ['text_es' => fake()->sentence()],
        ];
    }
}
