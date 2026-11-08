<?php

namespace Tests\Feature\Auth;

use App\Exceptions\ApiException;
use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\ImportedMembership;
use App\Models\Setting;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use App\Services\MembershipStore;
use App\Services\RegistrationPhoto;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

class PaidRegistrationTest extends TestCase
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

    private function membership(array $attributes = []): ImportedMembership
    {
        $term = AcademicTerm::factory()->create(['starts_on' => today()->subDay(), 'ends_on' => today()->addDay()]);

        return ImportedMembership::factory()->create([...['academic_term_id' => $term->id, 'authorization_number' => 'A', 'email' => 'c@upr.edu'], ...$attributes]);
    }

    private function acknowledge(): void
    {
        $notice = $this->getJson('/api/user/registration/privacy')->assertOk();
        $this->postJson('/api/user/registration/privacy', ['version' => $notice->json('version')])->assertNoContent();
    }

    private function payload(string $number = 'A'): array
    {
        return [
            'authorization_number' => $number, 'password' => 'a long password', 'password_confirmation' => 'a long password',
            'photo' => UploadedFile::fake()->createWithContent('photo.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')),
            'waiver_accepted' => true, 'waiver_version' => 'test-v1',
            'emergency_contact_name' => 'Ana Rodríguez', 'emergency_contact_phone' => '787 555 0100', 'locale' => 'es',
        ];
    }

    private function savedPhoto(): void
    {
        $this->mock(RegistrationPhoto::class)->shouldReceive('save')->once()->andReturnUsing(function () {
            $this->assertDatabaseCount('users', 0);
            $this->assertDatabaseCount('authorizations', 0);
            Storage::disk('local')->put('photos/registration.jpg', 'converted JPEG');

            return 'photos/registration.jpg';
        });
    }

    public function test_privacy_must_be_shown_and_acknowledged_before_lookup(): void
    {
        $this->membership();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])->assertForbidden();
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])
            ->assertOk()->assertJsonPath('masked_email', 'c***@upr.edu')->assertDontSee('c@upr.edu');
    }

    public function test_lookup_allows_letters_and_does_not_check_length_or_claim_anything(): void
    {
        $member = $this->membership(['authorization_number' => 'LONGERthan6letters']);
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'LONGERthan6letters'])
            ->assertOk()->assertJsonPath('state', 'ready')->assertJsonPath('name', $member->name);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
    }

    public function test_authorization_number_ignores_letter_case(): void
    {
        $member = $this->membership(['authorization_number' => 'AB12C3']);
        $this->acknowledge();
        foreach (['ab12c3', 'AB12C3', 'Ab12c3'] as $typed) {
            $this->postJson('/api/user/registration/lookup', ['authorization_number' => $typed])
                ->assertOk()->assertJsonPath('name', $member->name);
        }
        $member->update(['authorization_number' => 'cd45e6']);
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'CD45E6'])->assertOk()->assertJsonPath('name', $member->name);
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'cd45e7'])->assertUnprocessable();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => str_repeat('A', 21)])
            ->assertUnprocessable()->assertJsonPath('error.code', 'validation_failed');
    }

    public function test_the_contact_number_comes_from_the_settings(): void
    {
        Setting::query()->create(['name' => 'contact_phone', 'value' => '787-555-0199']);
        $this->acknowledge();
        $this->getJson('/api/user/registration/privacy')->assertOk()->assertJsonPath('contact_number', '787-555-0199');
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'missing'])
            ->assertUnprocessable()->assertJsonPath('error.details.contact_number.0', '787-555-0199');
    }

    public function test_invalid_claimed_and_ended_numbers_have_identical_responses(): void
    {
        $member = $this->membership();
        Authorization::factory()->create(['imported_membership_id' => $member->id, 'academic_term_id' => $member->academic_term_id]);
        $this->acknowledge();
        $invalid = $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'missing'])->assertUnprocessable()->json();
        $this->assertSame($invalid, $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])->assertUnprocessable()->json());
        Authorization::query()->delete();
        $member->academicTerm->update(['starts_on' => today()->subDays(10), 'ends_on' => today()->subDay()]);
        $this->assertSame($invalid, $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])->assertUnprocessable()->json());
        $this->assertSame('265-3866', $invalid['error']['details']['contact_number'][0]);
    }

    public function test_existing_payment_email_returns_renewal_without_claiming(): void
    {
        $this->membership(['email' => 'Member@upr.edu']);
        User::factory()->create(['email' => 'member@upr.edu']);
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])
            ->assertOk()->assertExactJson(['state' => 'renewal', 'masked_email' => 'M***r@upr.edu']);
        $this->post('/api/user/registration/complete', $this->payload(), ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('state', 'renewal');
        $this->assertDatabaseCount('authorizations', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_missing_number_uses_the_store_interface_without_network(): void
    {
        $this->acknowledge();
        $this->mock(MembershipStore::class)->shouldReceive('find')->once()->with('NEW')->andReturn(null);
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'new'])->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_an_order_imported_by_the_store_adapter_is_checked_before_returning_its_masked_email(): void
    {
        $this->acknowledge();
        $this->mock(MembershipStore::class)->shouldReceive('find')->once()->with('NEW')
            ->andReturnUsing(fn () => $this->membership(['authorization_number' => 'new']));
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'new'])
            ->assertOk()->assertJsonPath('masked_email', 'c***@upr.edu');
        Http::assertNothingSent();
    }

    public function test_per_ip_pause_expires_and_blank_input_does_not_count(): void
    {
        config(['registration.ip_failures' => 2, 'registration.window_seconds' => 60]);
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => ''])->assertUnprocessable();
        for ($i = 0; $i < 2; $i++) {
            $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertUnprocessable();
        }
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertTooManyRequests()->assertHeader('Retry-After');
        $this->travel(61)->seconds();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertUnprocessable();
    }

    public function test_ipv6_addresses_in_the_same_64_prefix_share_the_limit(): void
    {
        config(['registration.ip_failures' => 1]);
        $this->acknowledge();
        $this->withServerVariables(['REMOTE_ADDR' => '2001:db8:1:2::1'])
            ->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertUnprocessable();
        $this->withServerVariables(['REMOTE_ADDR' => '2001:db8:1:2::2'])
            ->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertTooManyRequests();
    }

    public function test_ready_and_renewal_lookups_return_the_reserved_ip_attempt(): void
    {
        config(['registration.ip_failures' => 2]);
        $member = $this->membership();
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertUnprocessable();
        foreach (['ready', 'renewal'] as $state) {
            if ($state === 'renewal') {
                User::factory()->create(['email' => $member->email]);
            }
            for ($i = 0; $i < 3; $i++) {
                $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])
                    ->assertOk()->assertJsonPath('state', $state);
            }
        }
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertUnprocessable();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertTooManyRequests();
    }

    public function test_nine_digits_are_rejected_before_membership_lookup_and_do_not_count_against_the_ip_limit(): void
    {
        config(['registration.ip_failures' => 1]);
        $this->acknowledge();
        $this->mock(MembershipStore::class)->shouldNotReceive('find');
        $this->mock(RegistrationPhoto::class)->shouldNotReceive('save');
        $queries = [];
        DB::listen(function ($query) use (&$queries) {
            if (str_contains($query->sql, 'imported_memberships')) {
                $queries[] = $query->sql;
            }
        });
        foreach (['123456789', '802123456', '000000000'] as $number) {
            $this->postJson('/api/user/registration/lookup', ['authorization_number' => $number])
                ->assertUnprocessable()->assertExactJson(['error' => [
                    'code' => 'validation_failed', 'details' => ['authorization_number' => ['not_regex']],
                ]]);
            $this->post('/api/user/registration/complete', $this->payload($number), ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertExactJson(['error' => [
                    'code' => 'validation_failed', 'details' => ['authorization_number' => ['not_regex']],
                ]]);
        }
        $this->assertSame([], $queries);
        $this->assertSame(0, RateLimiter::attempts('registration:ip:'.hash('sha256', '127.0.0.1')));
        $this->assertSame(0, RateLimiter::attempts('registration:global'));
    }

    public function test_ten_digits_are_looked_up_as_an_authorization_number(): void
    {
        $this->acknowledge();
        $this->mock(MembershipStore::class)->shouldReceive('find')->once()->with('1234567890')
            ->andReturnUsing(fn () => $this->membership(['authorization_number' => '1234567890']));
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => '1234567890'])
            ->assertOk()->assertJsonPath('state', 'ready');
        Http::assertNothingSent();
    }

    public function test_global_slow_mode_alerts_once_and_never_blocks_a_valid_lookup(): void
    {
        config(['registration.global_failures' => 2, 'registration.window_seconds' => 60, 'registration.slow_milliseconds' => 1]);
        $this->membership();
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad'])->assertUnprocessable();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad2'])->assertUnprocessable();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'bad3'])->assertUnprocessable();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])->assertOk();
        $this->assertSame(1, AuditLogEntry::query()->where('action', 'registration_lookup_slow_mode')->count());
        $entry = AuditLogEntry::query()->where('action', 'registration_lookup_slow_mode')->sole();
        $this->assertNull($entry->staff_account_id);
        $this->assertSame(['failure_count' => 2, 'window_seconds' => 60], $entry->after_values);
    }

    public function test_photo_is_saved_before_account_claim_and_waiver_and_payment_email_is_immutable(): void
    {
        $member = $this->membership();
        $this->acknowledge();
        $this->savedPhoto();
        $payload = $this->payload();
        $payload['email'] = 'attacker@example.com';
        $payload['full_name'] = 'attacker';
        $response = $this->post('/api/user/registration/complete', $payload, ['Accept' => 'application/json'])->assertCreated();
        $user = User::query()->sole();
        $this->assertSame($member->email, $user->email);
        $this->assertTrue(Hash::check('a long password', $user->password));
        $this->assertDatabaseHas('authorizations', ['user_id' => $user->id, 'imported_membership_id' => $member->id, 'photo_path' => 'photos/registration.jpg', 'created_account' => true]);
        $waiver = WaiverAcceptance::query()->sole();
        $this->assertSame($member->name, $waiver->full_name);
        $this->assertSame($member->email, $waiver->email);
        $this->assertSame('test-v1', $waiver->waiver_version);
        $this->assertEqualsWithDelta(now()->timestamp, $waiver->accepted_at->timestamp, 2);
        $this->keepingTheSessionOf($response)->getJson('/api/user/me')->assertOk();
    }

    public function test_photo_failure_leaves_number_free_and_retry_can_succeed(): void
    {
        $this->membership();
        $this->acknowledge();
        $this->mock(RegistrationPhoto::class)->shouldReceive('save')->once()->andThrow(new ApiException('registration_photo_failed', 422));
        $this->post('/api/user/registration/complete', $this->payload(), ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('waiver_acceptances', 0);
        $this->assertDatabaseCount('authorizations', 0);
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])->assertOk();
    }

    public function test_a_photo_over_10_mb_or_with_wrong_contents_is_rejected_before_storage(): void
    {
        $this->membership();
        $this->acknowledge();
        $this->mock(RegistrationPhoto::class)->shouldNotReceive('save');
        $path = tempnam(sys_get_temp_dir(), 'registration-photo-');
        try {
            file_put_contents($path, '<script>alert(1)</script>');
            foreach ([[UploadedFile::fake()->create('huge.png', 10241, 'image/png'), 'max'],
                [new UploadedFile($path, 'photo.jpg', 'image/jpeg', null, true), 'mimetypes']] as [$file, $rule]) {
                $this->post('/api/user/registration/complete', [...$this->payload(), 'photo' => $file], ['Accept' => 'application/json'])
                    ->assertUnprocessable()->assertJsonPath('error.details.photo', [$rule]);
            }
        } finally {
            unlink($path);
        }
        $this->assertDatabaseCount('users', 0);
    }

    public function test_corrupt_jpeg_content_fails_photo_processing_without_creating_registration_data(): void
    {
        $this->membership();
        $this->acknowledge();
        $path = tempnam(sys_get_temp_dir(), 'registration-photo-');
        try {
            file_put_contents($path, "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00garbage");
            $photo = new UploadedFile($path, 'photo.jpg', 'image/jpeg', null, true);
            $this->post('/api/user/registration/complete', [...$this->payload(), 'photo' => $photo], ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonPath('error.code', 'registration_photo_failed');
        } finally {
            unlink($path);
        }
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
        $this->assertSame([], Storage::disk('local')->allFiles('photos'));
    }

    public function test_waiver_text_and_version_must_be_available_and_current(): void
    {
        $this->membership();
        $this->acknowledge();
        $this->getJson('/api/user/registration/waiver?locale=en')->assertOk()->assertJsonPath('version', 'test-v1');
        config(['registration.waiver.en' => null]);
        $this->getJson('/api/user/registration/waiver?locale=en')->assertServiceUnavailable();
        $this->post('/api/user/registration/complete', [...$this->payload(), 'locale' => 'en'], ['Accept' => 'application/json'])
            ->assertServiceUnavailable();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_final_submit_answers_503_when_the_shipped_config_has_no_waiver(): void
    {
        $this->membership();
        $this->acknowledge();
        config(['registration.waiver' => (require config_path('registration.php'))['waiver']]);
        $this->post('/api/user/registration/complete', $this->payload(), ['Accept' => 'application/json'])
            ->assertServiceUnavailable()->assertJsonPath('error.code', 'registration_waiver_unavailable');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_final_submit_rechecks_term_and_order_status(): void
    {
        $member = $this->membership();
        $this->acknowledge();
        $this->postJson('/api/user/registration/lookup', ['authorization_number' => 'A'])->assertOk();
        $member->update(['order_status' => 'refunded']);
        $this->post('/api/user/registration/complete', $this->payload(), ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_compromised_password_is_rejected_before_storage(): void
    {
        $this->membership();
        $this->acknowledge();
        $this->mock(UncompromisedVerifier::class)->shouldReceive('verify')->andReturn(false);
        $this->mock(RegistrationPhoto::class)->shouldNotReceive('save');
        $this->post('/api/user/registration/complete', $this->payload(), ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertDatabaseCount('users', 0);
    }

    public function test_a_claim_won_during_photo_processing_leaves_no_second_account_or_orphan_photo(): void
    {
        $member = $this->membership();
        $this->acknowledge();
        $this->mock(RegistrationPhoto::class)->shouldReceive('save')->once()->andReturnUsing(function () use ($member) {
            Authorization::factory()->create(['academic_term_id' => $member->academic_term_id, 'imported_membership_id' => $member->id]);
            Storage::disk('local')->put('photos/loser.jpg', 'photo');

            return 'photos/loser.jpg';
        });
        $this->post('/api/user/registration/complete', $this->payload(), ['Accept' => 'application/json'])->assertUnprocessable();
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('authorizations', 1);
        $this->assertDatabaseCount('waiver_acceptances', 0);
        Storage::disk('local')->assertMissing('photos/loser.jpg');
    }

    public function test_database_failure_rolls_back_account_and_claim_and_removes_the_saved_photo(): void
    {
        $this->membership();
        $this->acknowledge();
        $this->savedPhoto();
        WaiverAcceptance::creating(function () {
            throw new \RuntimeException('Waiver storage failed.');
        });
        $this->post('/api/user/registration/complete', $this->payload(), ['Accept' => 'application/json'])->assertStatus(500);
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('waiver_acceptances', 0);
        $this->assertDatabaseCount('authorizations', 0);
        Storage::disk('local')->assertMissing('photos/registration.jpg');
    }

    public function test_privacy_version_and_waiver_locale_injections_are_rejected_as_values(): void
    {
        $this->acknowledge();
        foreach (["' OR 1=1; --", '<script>alert(1)</script>'] as $value) {
            $this->postJson('/api/user/registration/privacy', ['version' => $value])->assertUnprocessable();
            $this->getJson('/api/user/registration/waiver?locale='.urlencode($value))->assertUnprocessable();
        }
        $this->assertDatabaseCount('users', 0);
    }

    #[DataProvider('invalidInputs')]
    public function test_server_rejects_invalid_inputs_before_creating_an_account(string $field, mixed $value): void
    {
        $this->membership();
        $this->acknowledge();
        $this->post('/api/user/registration/complete', [...$this->payload(), $field => $value], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('authorizations', 0);
    }

    public static function invalidInputs(): array
    {
        return [
            ['password', 'short'], ['password_confirmation', 'different'], ['waiver_accepted', false],
            ['waiver_version', 'old'], ['emergency_contact_name', ''], ['emergency_contact_phone', 'abc'],
            ['locale', 'fr'], ['photo', null], ['photo', 'fake.jpg'],
            ['authorization_number', ['A']], ['authorization_number', str_repeat('A', 21)],
        ];
    }

    #[DataProvider('injections')]
    public function test_each_input_handles_sql_and_script_as_data(string $field, string $payload): void
    {
        $member = $this->membership();
        $this->acknowledge();
        $data = $this->payload();
        if (in_array($field, ['password', 'password_confirmation'], true)) {
            $data['password'] = $data['password_confirmation'] = $payload;
        } else {
            $data[$field] = $payload;
        }
        if (in_array($field, ['password', 'password_confirmation', 'emergency_contact_name'], true)) {
            $this->savedPhoto();
            $this->post('/api/user/registration/complete', $data, ['Accept' => 'application/json'])->assertCreated();
        } else {
            $this->post('/api/user/registration/complete', $data, ['Accept' => 'application/json'])->assertUnprocessable();
        }
        $this->assertDatabaseHas('imported_memberships', ['id' => $member->id, 'email' => $member->email]);
    }

    public static function injections(): array
    {
        $cases = [];
        foreach (['authorization_number', 'password', 'password_confirmation', 'waiver_accepted', 'waiver_version', 'emergency_contact_name', 'emergency_contact_phone', 'locale', 'photo'] as $field) {
            foreach (["' OR 1=1; DROP TABLE users; --", '<script>alert(1)</script>'] as $payload) {
                $cases[] = [$field, $payload];
            }
        }

        return $cases;
    }

    public function test_staff_and_signed_in_users_cannot_register_or_lookup(): void
    {
        $this->actingAs(StaffAccount::factory()->create(), 'staff');
        foreach (['privacy', 'lookup', 'complete'] as $route) {
            $this->postJson('/api/user/registration/'.$route, [])->assertForbidden();
        }
        $this->app['auth']->forgetGuards();
        $this->actingAs(User::factory()->create(), 'web');
        $this->postJson('/api/user/registration/complete', [])->assertForbidden();
    }
}
