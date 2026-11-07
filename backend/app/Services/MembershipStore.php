<?php

namespace App\Services;

use App\Models\ImportedMembership;

interface MembershipStore
{
    public function find(string $authorizationNumber): ?ImportedMembership;
}
