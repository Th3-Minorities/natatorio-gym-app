<?php

namespace App\Services;

use App\Models\AcademicTerm;
use App\Models\Setting;

/** The privacy notice data (N-08), shared by registration and the signed-in User's account. */
class PrivacyNotice
{
    public function __construct(private readonly RegistrationLookup $lookup) {}

    /** @return array{version: mixed, draft: bool, contact_number: string, store_url: string|null} */
    public function payload(): array
    {
        $version = config('registration.privacy_version');
        $url = Setting::query()->where('name', 'store_url')->value('value');
        $currentTerm = AcademicTerm::query()->where('starts_on', '<=', today())->where('ends_on', '>=', today())->exists();

        return [
            'version' => $version, 'draft' => $version === 'draft', 'contact_number' => $this->lookup->contactNumber(),
            'store_url' => $currentTerm && is_string($url) && filter_var($url, FILTER_VALIDATE_URL)
                && in_array(strtolower(parse_url($url, PHP_URL_SCHEME) ?? ''), ['https', 'http'], true) ? $url : null,
        ];
    }
}
