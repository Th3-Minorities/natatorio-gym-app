<?php

use App\Exceptions\ApiException;
use App\Http\Controllers\AthleteRegistrationController;
use App\Http\Controllers\PaidRegistrationController;
use App\Services\AthleteLinks;
use App\Services\RegistrationLookup;
use App\Services\RegistrationPhoto;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$input = json_decode(fgets(STDIN), true, flags: JSON_THROW_ON_ERROR);
config([
    'database.default' => 'pgsql', 'database.connections.pgsql' => $input['connection'],
    'session.driver' => 'array', 'cache.default' => 'array',
    'filesystems.disks.local.root' => $input['root'],
    'registration.waiver.version' => 'test-v1', 'registration.waiver.es' => 'Test waiver',
]);
DB::purge('pgsql');
$app->instance(UncompromisedVerifier::class, new class implements UncompromisedVerifier
{
    public function verify($data): bool
    {
        return true;
    }
});
$photos = new class extends RegistrationPhoto
{
    public function save(UploadedFile $file): string
    {
        $path = 'photos/'.Str::uuid().'.jpg';
        Storage::disk('local')->put($path, 'converted photo');
        // Both requests have validated and saved their photo before either may claim.
        echo "photo-saved\n";
        flush();
        if (trim(fgets(STDIN)) !== 'claim') {
            throw new RuntimeException('Missing claim barrier.');
        }

        return $path;
    }
};
$temporary = tempnam(sys_get_temp_dir(), 'registration-');
file_put_contents($temporary, base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='));
$athlete = ($input['mode'] ?? 'paid') === 'athlete';
$fields = [
    'password' => 'a long password', 'password_confirmation' => 'a long password',
    'waiver_accepted' => true, 'waiver_version' => 'test-v1',
    'emergency_contact_name' => 'Ana', 'emergency_contact_phone' => '787 555 0100', 'locale' => 'es',
];
$request = Request::create('/api/user/registration/'.($athlete ? 'athlete/' : '').'complete', 'POST',
    $athlete ? ['token' => 'tok', ...$fields] : ['authorization_number' => 'A', ...$fields],
    files: ['photo' => new UploadedFile($temporary, 'photo.png', 'image/png', test: true)]);
$session = $app->make('session')->driver();
$session->start();
$session->put('registration_privacy_accepted', config('registration.privacy_version'));
$request->setLaravelSession($session);
$app->instance('request', $request);
try {
    $response = $athlete
        ? $app->make(AthleteRegistrationController::class)->completeAthlete($request, $app->make(AthleteLinks::class), $app->make(RegistrationLookup::class), $photos)
        : $app->make(PaidRegistrationController::class)->complete($request, $app->make(RegistrationLookup::class), $photos);
    echo $response->getStatusCode();
} catch (ApiException $error) {
    echo $error->status;
} finally {
    unlink($temporary);
}
