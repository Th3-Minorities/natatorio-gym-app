<?php

// The PWA and the API share one origin (the proxy sends / to the PWA and /api to Laravel), so the
// browser never makes a cross-origin call and no other site needs access. Laravel's default allows
// every origin, which would let any web page read /api answers. Allow none on purpose.
// Only add an origin here if a second origin is ever really needed (docs/design/architecture.md, M-03).

return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
