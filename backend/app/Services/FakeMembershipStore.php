<?php

namespace App\Services;

use App\Models\ImportedMembership;

/** Local-only stand-in until the store sync is connected. Never performs a network request. */
class FakeMembershipStore implements MembershipStore
{
    public function find(string $authorizationNumber): ?ImportedMembership
    {
        return null;
    }
}
