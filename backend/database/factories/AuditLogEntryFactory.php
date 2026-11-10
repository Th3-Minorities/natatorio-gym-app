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
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'action' => 'authorization.revoke',
            'subject_table' => 'authorizations',
            'subject_id' => fake()->numberBetween(1, 1000),
            'before_values' => ['status' => 'active'],
            'after_values' => ['status' => 'revoked'],
            'reason' => 'Refund made in the payment gateway.',
        ];
    }
}
