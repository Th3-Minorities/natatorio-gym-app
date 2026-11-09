<?php

namespace Tests\Feature\Auth;

use App\Models\AcademicTerm;
use App\Models\Authorization;
use App\Models\EmailLink;
use App\Models\RosterRecord;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use App\Notifications\AthleteRegistrationLink;
use App\Services\RegistrationPhoto;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/** Athlete registration by email link (diagram 4, REQ-F-15, REQ-F-17, E-73). */
class AthleteRegistrationTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->fromThePwa();
        Cache::flush();
        Storage::fake('local');
        Http::preventStrayRequests();
        $this->mock(UncompromisedVerifier::class)->shouldReceive('verify')->andReturn(true);
        config(['registration.waiver.version' => 'test-v1', 'registration.waiver.es' => 'Test waiver', 'registration.waiver.en' => 'Test waiver']);
    }

    private function record(array $attributes = []): RosterRecord
    {
        return RosterRecord::factory()->create(['student_number' => '802123456', 'name' => 'Marta Ruiz', 'institutional_email' => 'marta.ruiz@upr.edu', ...$attributes]);
    }

    private function term(): AcademicTerm
    {
        return AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);
    }

    private function acknowledge(): void
    {
        $notice = $this->getJson('/api/user/registration/privacy')->assertOk();
        $this->postJson('/api/user/registration/privacy', ['version' => $notice->json('version')])->assertNoContent();
    }

    /** Asks for a link the way the registration screen does and returns the token from the email. */
    private function requestLink(string $locale = 'es'): string
    {
        Notification::fake();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456', 'locale' => $locale])->assertOk();
        $token = null;
        Notification::assertSentOnDemand(AthleteRegistrationLink::class, function (AthleteRegistrationLink $mail) use (&$token) {
            $token = $mail->token;

            return true;
        });

        return $token;
    }

    private function link(RosterRecord $record, string $token, array $attributes = []): EmailLink
    {
        return EmailLink::factory()->create(['roster_record_id' => $record->id, 'token_hash' => hash('sha256', $token), ...$attributes]);
    }

    private function payload(string $token): array
    {
        return [
            'token' => $token, 'password' => 'a long password', 'password_confirmation' => 'a long password',
            'photo' => UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')),
            'waiver_accepted' => true, 'waiver_version' => 'test-v1',
            'emergency_contact_name' => 'Ana Rodríguez', 'emergency_contact_phone' => '787 555 0100', 'locale' => 'en',
        ];
    }

    private function savedPhoto(): void
    {
        $this->mock(RegistrationPhoto::class)->shouldReceive('save')->once()->andReturnUsing(function () {
            Storage::disk('local')->put('photos/athlete.jpg', 'converted JPEG');

            return 'photos/athlete.jpg';
        });
    }

    private function noPhoto(): void
    {
        $this->mock(RegistrationPhoto::class)->shouldNotReceive('save');
    }

    public function test_a_student_number_on_the_roster_sends_a_link_to_the_roster_email_and_creates_nothing(): void
    {
        $record = $this->record();
        $this->acknowledge();
        Notification::fake();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456', 'locale' => 'en'])
            ->assertOk()->assertExactJson(['state' => 'athlete', 'masked_email' => 'm***z@upr.edu', 'resend_in' => 300])
            ->assertDontSee('marta.ruiz');
        Notification::assertSentOnDemand(AthleteRegistrationLink::class, function (AthleteRegistrationLink $mail, array $channels, AnonymousNotifiable $to) use ($record) {
            $link = EmailLink::query()->sole();
            $this->assertSame(hash('sha256', $mail->token), $link->token_hash);
            $this->assertNotSame($mail->token, $link->token_hash);
            $this->assertSame($record->id, $link->roster_record_id);
            $this->assertEqualsWithDelta(now()->addHours(24)->timestamp, $link->expires_at->timestamp, 2);

            return $to->routes['mail'] === 'marta.ruiz@upr.edu' && $mail->language === 'en';
        });
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
    }

    public function test_the_email_is_in_the_language_of_the_registration_screen_and_opens_the_link_page(): void
    {
        $this->record();
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456', 'locale' => 'en'])->assertOk();
        $this->travel(6)->minutes();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456'])->assertOk();
        $messages = Mail::mailer()->getSymfonyTransport()->messages();
        $this->assertCount(2, $messages);
        $english = $messages[0]->getOriginalMessage();
        $spanish = $messages[1]->getOriginalMessage();
        $this->assertSame('marta.ruiz@upr.edu', $english->getTo()[0]->getAddress());
        $this->assertSame('Complete your athlete registration', $english->getSubject());
        $this->assertStringContainsString('expires in 24 hours', $english->getHtmlBody());
        $this->assertMatchesRegularExpression('#/register/athlete\?token=[A-Za-z0-9]{64}"#', $english->getHtmlBody());
        $this->assertSame('Completa tu registro de atleta', $spanish->getSubject());
    }

    public function test_a_roster_email_that_already_has_an_account_signs_in_instead_and_gets_no_link(): void
    {
        $this->record();
        User::factory()->create(['email' => 'MARTA.RUIZ@upr.edu']);
        $this->acknowledge();
        Notification::fake();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456'])
            ->assertOk()->assertExactJson(['state' => 'renewal', 'masked_email' => 'm***z@upr.edu']);
        Notification::assertNothingSent();
        $this->assertDatabaseCount('email_links', 0);
    }

    public function test_one_link_every_5_minutes_and_5_a_day_per_student_number(): void
    {
        $this->record();
        $this->acknowledge();
        Notification::fake();
        $lookup = fn () => $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456']);
        $lookup()->assertOk();
        $this->travel(4)->minutes();
        $lookup()->assertTooManyRequests()->assertExactJson(['error' => ['code' => 'athlete_link_limit']])->assertHeader('Retry-After', '60');
        for ($sent = 2; $sent <= 5; $sent++) {
            $this->travel(5)->minutes();
            $lookup()->assertOk();
        }
        $this->travel(5)->minutes();
        // The first of the 5 links was sent 29 minutes ago, so the next one waits until 24 hours after it.
        $lookup()->assertTooManyRequests()->assertJsonPath('error.code', 'athlete_link_limit')->assertHeader('Retry-After', (string) (24 * 3600 - 29 * 60));
        Notification::assertSentOnDemandTimes(AthleteRegistrationLink::class, 5);
        $this->travel(24 * 60 - 29)->minutes();
        $lookup()->assertOk();
    }

    public function test_the_limit_is_per_student_number(): void
    {
        $this->record();
        $this->record(['student_number' => '802000002', 'institutional_email' => 'other@upr.edu']);
        $this->acknowledge();
        Notification::fake();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456'])->assertOk();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802000002'])->assertOk();
        Notification::assertSentOnDemandTimes(AthleteRegistrationLink::class, 2);
    }

    public function test_a_valid_link_shows_the_roster_name_and_creates_nothing(): void
    {
        $this->record();
        $this->acknowledge();
        $token = $this->requestLink();
        $this->postJson('/api/user/registration/athlete/validate', ['token' => $token])
            ->assertOk()->assertExactJson(['name' => 'Marta Ruiz']);
        $this->assertDatabaseCount('users', 0);
        $this->assertNull(EmailLink::query()->sole()->used_at);
    }

    public function test_each_link_state_has_its_own_code(): void
    {
        $record = $this->record();
        $this->link($record, 'expired', ['expires_at' => now()->subSecond()]);
        $this->link($record, 'used', ['used_at' => now()]);
        $this->link($record, 'replaced');
        $this->link($record, 'newest');
        $removed = $this->record(['student_number' => '802000003', 'removed_at' => now()]);
        $this->link($removed, 'removed');
        $validate = fn (string $token) => $this->postJson('/api/user/registration/athlete/validate', ['token' => $token]);
        $validate('unknown')->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_invalid']]);
        $validate('removed')->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_invalid']]);
        $validate('used')->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_used']]);
        $validate('replaced')->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_replaced']]);
        $validate('expired')->assertUnprocessable()->assertJsonPath('error.code', 'athlete_link_replaced');
        $validate('newest')->assertOk();
        $this->travel(2)->hours();
        $validate('newest')->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_expired']]);
    }

    public function test_a_record_claimed_since_the_link_was_sent_is_refused_with_the_contact_number(): void
    {
        $record = $this->record();
        $this->link($record, 'token');
        Authorization::factory()->athlete($record)->create(['status' => 'revoked']);
        $this->postJson('/api/user/registration/athlete/validate', ['token' => 'token'])
            ->assertUnprocessable()->assertExactJson(['error' => [
                'code' => 'roster_record_claimed', 'details' => ['contact_number' => ['265-3866']],
            ]]);
    }

    public function test_the_link_page_creates_the_athlete_account_and_signs_in(): void
    {
        $record = $this->record();
        $term = $this->term();
        $this->acknowledge();
        $token = $this->requestLink();
        $this->savedPhoto();
        $payload = [...$this->payload($token), 'email' => 'attacker@example.com', 'full_name' => 'attacker'];
        $response = $this->post('/api/user/registration/athlete/complete', $payload, ['Accept' => 'application/json'])->assertCreated();
        $user = User::query()->sole();
        $this->assertSame('marta.ruiz@upr.edu', $user->email);
        $this->assertSame('en', $user->locale);
        $this->assertTrue(Hash::check('a long password', $user->password));
        $this->assertDatabaseHas('authorizations', [
            'user_id' => $user->id, 'academic_term_id' => $term->id, 'type' => 'athlete', 'status' => 'active',
            'roster_record_id' => $record->id, 'photo_path' => 'photos/athlete.jpg', 'created_account' => true,
        ]);
        $waiver = WaiverAcceptance::query()->sole();
        $this->assertSame('Marta Ruiz', $waiver->full_name);
        $this->assertSame('marta.ruiz@upr.edu', $waiver->email);
        $this->assertSame('test-v1', $waiver->waiver_version);
        $this->assertNotNull(EmailLink::query()->sole()->used_at);
        $this->keepingTheSessionOf($response)->getJson('/api/user/me')->assertOk();
        // The same link from a signed-out browser.
        $this->defaultCookies = [];
        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $this->acknowledge();
        $this->noPhoto();
        $this->post('/api/user/registration/athlete/complete', $this->payload($token), ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'athlete_link_used');
        $this->assertDatabaseCount('users', 1);
    }

    public function test_the_final_step_checks_the_link_again_and_an_expired_link_creates_nothing(): void
    {
        $this->record();
        $this->term();
        $this->acknowledge();
        $token = $this->requestLink();
        $this->postJson('/api/user/registration/athlete/validate', ['token' => $token])->assertOk();
        $this->travel(25)->hours();
        $this->noPhoto();
        $this->post('/api/user/registration/athlete/complete', $this->payload($token), ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'athlete_link_expired');
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
        $this->assertDatabaseCount('waiver_acceptances', 0);
    }

    public function test_the_final_step_needs_the_privacy_notice_and_a_current_term(): void
    {
        $this->link($this->record(), 'token');
        $token = 'token';
        $this->noPhoto();
        $this->post('/api/user/registration/athlete/complete', $this->payload($token), ['Accept' => 'application/json'])
            ->assertForbidden()->assertJsonPath('error.code', 'registration_privacy_required');
        $this->acknowledge();
        $this->savedPhoto();
        $this->post('/api/user/registration/athlete/complete', $this->payload($token), ['Accept' => 'application/json'])
            ->assertConflict()->assertJsonPath('error.code', 'conflict');
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
        $this->assertNull(EmailLink::query()->sole()->used_at);
        Storage::disk('local')->assertMissing('photos/athlete.jpg');
    }

    public function test_an_account_made_for_the_roster_email_meanwhile_gets_the_sign_in_answer(): void
    {
        $this->record();
        $this->term();
        $this->acknowledge();
        $token = $this->requestLink();
        User::factory()->create(['email' => 'marta.ruiz@upr.edu']);
        $this->noPhoto();
        $this->post('/api/user/registration/athlete/complete', $this->payload($token), ['Accept' => 'application/json'])
            ->assertOk()->assertExactJson(['state' => 'renewal', 'masked_email' => 'm***z@upr.edu']);
        $this->assertDatabaseCount('authorizations', 0);
    }

    public function test_a_claim_won_during_photo_processing_leaves_no_second_account_or_orphan_photo(): void
    {
        $record = $this->record();
        $this->term();
        $this->acknowledge();
        $token = $this->requestLink();
        $this->mock(RegistrationPhoto::class)->shouldReceive('save')->once()->andReturnUsing(function () use ($record) {
            Authorization::factory()->athlete($record)->create();
            Storage::disk('local')->put('photos/athlete.jpg', 'converted JPEG');

            return 'photos/athlete.jpg';
        });
        $this->post('/api/user/registration/athlete/complete', $this->payload($token), ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'roster_record_claimed')->assertJsonPath('error.details.contact_number.0', '265-3866');
        $this->assertDatabaseCount('authorizations', 1);
        $this->assertDatabaseCount('waiver_acceptances', 0);
        Storage::disk('local')->assertMissing('photos/athlete.jpg');
    }

    public function test_link_inputs_handle_sql_and_script_as_data_and_reject_bad_shapes(): void
    {
        $this->record();
        $this->acknowledge();
        foreach (["' OR 1=1; DROP TABLE users; --", '<script>alert(1)</script>'] as $payload) {
            $this->postJson('/api/user/registration/athlete/validate', ['token' => $payload])
                ->assertUnprocessable()->assertExactJson(['error' => ['code' => 'athlete_link_invalid']]);
            $this->postJson('/api/user/registration/lookup', ['authorization_number' => '802123456', 'locale' => $payload])
                ->assertUnprocessable()->assertJsonPath('error.details.locale', ['in']);
        }
        foreach ([['token' => ['a']], ['token' => str_repeat('a', 256)], []] as $body) {
            $this->postJson('/api/user/registration/athlete/validate', $body)->assertUnprocessable()->assertJsonPath('error.code', 'validation_failed');
        }
        $this->noPhoto();
        $this->post('/api/user/registration/athlete/complete', [...$this->payload('x'), 'token' => ['x']], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'validation_failed');
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('roster_records', 1);
    }

    public function test_the_final_step_allows_10_calls_a_minute_from_one_ip_and_the_11th_gets_429(): void
    {
        $this->acknowledge();
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/user/registration/athlete/complete', ['token' => 'x'])->assertUnprocessable();
        }
        $this->postJson('/api/user/registration/athlete/complete', ['token' => 'x'])->assertStatus(429);
    }

    public function test_staff_and_signed_in_users_cannot_use_the_link_page(): void
    {
        $this->link($this->record(), 'token');
        $this->actingAs(StaffAccount::factory()->create(), 'staff');
        foreach (['validate', 'complete'] as $route) {
            $this->postJson('/api/user/registration/athlete/'.$route, ['token' => 'token'])
                ->assertForbidden()->assertJsonPath('error.code', 'forbidden');
        }
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->create(), 'web');
        foreach (['validate', 'complete'] as $route) {
            $this->postJson('/api/user/registration/athlete/'.$route, ['token' => 'token'])
                ->assertForbidden()->assertJsonPath('error.code', 'forbidden');
        }
    }
}
