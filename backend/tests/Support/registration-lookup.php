<?php

use App\Exceptions\ApiErrorRenderer;
use App\Http\Controllers\PaidRegistrationController;
use App\Models\ImportedMembership;
use App\Services\AthleteLinks;
use App\Services\MembershipStore;
use App\Services\RegistrationLookup;
use Illuminate\Cache\RateLimiter;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Facade;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$input = json_decode(fgets(STDIN), true, flags: JSON_THROW_ON_ERROR);
config([
    'database.default' => 'pgsql', 'database.connections.pgsql' => $input['connection'],
    'session.driver' => 'array', 'cache.default' => 'database', 'cache.limiter' => 'database', 'cache.prefix' => $input['prefix'],
    'cache.stores.database.connection' => 'pgsql',
    'registration.ip_failures' => $input['limit'], 'registration.window_seconds' => 60,
]);
$app->forgetInstance('cache');
$app->forgetInstance('cache.store');
$app->forgetInstance(RateLimiter::class);
Facade::clearResolvedInstances();
DB::purge('pgsql');
$limiter = $app->make(RateLimiter::class);
$cache = (new ReflectionProperty($limiter, 'cache'))->getValue($limiter);
echo get_class($cache->getStore())."\n";
$app->instance(MembershipStore::class, new class implements MembershipStore
{
    public function find(string $authorizationNumber): ?ImportedMembership
    {
        // Keep every admitted lookup open until all processes have tried to enter.
        echo "lookup\n";
        flush();
        if (trim(fgets(STDIN)) !== 'finish') {
            throw new RuntimeException('Missing lookup barrier.');
        }

        return null;
    }
});
$request = Request::create('/api/user/registration/lookup', 'POST', ['authorization_number' => 'missing'], server: ['REMOTE_ADDR' => '192.0.2.22']);
$session = $app->make('session')->driver();
$session->start();
$session->put('registration_privacy_accepted', config('registration.privacy_version'));
$request->setLaravelSession($session);
$app->instance('request', $request);
echo "ready\n";
flush();
if (trim(fgets(STDIN)) !== 'start') {
    throw new RuntimeException('Missing start barrier.');
}
try {
    $response = $app->make(PaidRegistrationController::class)->lookup($request, $app->make(RegistrationLookup::class), $app->make(AthleteLinks::class));
} catch (Throwable $error) {
    $response = ApiErrorRenderer::render($error);
    if (! in_array($response?->getStatusCode(), [422, 429], true)) {
        throw $error;
    }
}
echo $response->getStatusCode()."\n";
