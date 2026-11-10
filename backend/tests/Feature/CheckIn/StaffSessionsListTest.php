<?php

namespace Tests\Feature\CheckIn;

use App\Models\Authorization;
use App\Models\FacilitySession;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CallsTheApiFromThePwa;
use Tests\TestCase;

/**
 * S-01's list of active sessions (Figma 121:2841, REQ-F-44, REQ-F-45, #26): who is inside now, from the same rule
 * as occupancy, with each person's name, Check In time and type, and their photo for Staff to compare.
 */
class StaffSessionsListTest extends TestCase
{
    use CallsTheApiFromThePwa, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->startOfSecond());
    }

    private function asStaff(string $uri, string $role = 'staff'): TestResponse
    {
        return $this->actingAs(StaffAccount::factory()->create(['role' => $role]), 'staff')->fromThePwa()->getJson($uri);
    }

    /** A visit by someone whose waiver carries their name, as the profile reads it. */
    private function visit(string $name, int $minutesAgo): FacilitySession
    {
        $user = User::factory()->create();
        WaiverAcceptance::factory()->create(['user_id' => $user->id, 'full_name' => $name]);

        return FacilitySession::factory()->startedMinutesAgo($minutesAgo)->create(['user_id' => $user->id]);
    }

    public function test_the_list_shows_who_is_inside_in_check_in_order_with_their_type(): void
    {
        $user = User::factory()->create();
        WaiverAcceptance::factory()->create(['user_id' => $user->id, 'full_name' => 'Camila Rivera Santiago']);
        $authorization = Authorization::factory()->athlete()->create(['user_id' => $user->id]);
        $camila = FacilitySession::factory()->athlete('Voleibol')->startedMinutesAgo(74)
            ->create(['user_id' => $user->id, 'authorization_id' => $authorization->id]);
        $luis = $this->visit('Luis Méndez', 38);
        $luis->update(['authorization_type' => 'paid', 'member_group' => 'student']);
        $elena = $this->visit('Elena Santiago', 24);
        $elena->update(['authorization_type' => 'paid', 'member_group' => 'employee']);
        $javier = $this->visit('Javier Ortiz', 11);

        // Not inside: checked out, past the 2 hours, void.
        FacilitySession::factory()->startedMinutesAgo(50)->checkedOut(20)->create();
        FacilitySession::factory()->startedMinutesAgo(130)->create();
        FacilitySession::factory()->startedMinutesAgo(5)->create(['status' => 'void', 'ended_at' => now()]);

        $this->asStaff('/api/staff/sessions')->assertOk()
            ->assertJsonPath('sessions.*.id', [$camila->id, $luis->id, $elena->id, $javier->id])
            ->assertJsonPath('sessions.*.name', ['Camila Rivera Santiago', 'Luis Méndez', 'Elena Santiago', 'Javier Ortiz'])
            ->assertJsonPath('sessions.*.type', ['athlete', 'student', 'employee', 'manual'])
            ->assertJsonPath('sessions.0.sport', 'Voleibol')
            ->assertJsonPath('sessions.1.sport', null)
            ->assertJsonPath('sessions.0.started_at', now()->subMinutes(74)->toISOString())
            ->assertJsonPath('sessions.0.has_photo', true)
            ->assertJsonCount(6, 'sessions.0');
    }

    public function test_the_list_and_occupancy_agree(): void
    {
        $this->visit('Ana Torres', 30);
        $this->visit('Beto Ruiz', 10);
        FacilitySession::factory()->startedMinutesAgo(40)->endedEarly(10)->create();

        $listed = count($this->asStaff('/api/staff/sessions')->json('sessions'));
        $this->flushSession();
        $this->assertSame($listed, $this->asStaff('/api/staff/occupancy')->json('count'));
    }

    public function test_search_matches_part_of_the_name_in_any_case(): void
    {
        $camila = $this->visit('Camila Rivera Santiago', 30);
        $this->visit('Luis Méndez', 10);

        $this->asStaff('/api/staff/sessions?search=RIVERA')->assertJsonPath('sessions.*.id', [$camila->id]);
        $this->flushSession();
        $this->asStaff('/api/staff/sessions?search='.urlencode('  camila  '))->assertJsonPath('sessions.*.id', [$camila->id]);
    }

    public function test_search_wildcards_and_quotes_match_only_themselves(): void
    {
        $this->visit('Camila Rivera', 30);

        foreach (['%', '_', "' OR 1=1 --"] as $text) {
            $this->flushSession();
            $this->asStaff('/api/staff/sessions?search='.urlencode($text))->assertOk()->assertJsonPath('sessions', []);
        }
    }

    public function test_the_search_is_checked(): void
    {
        $this->asStaff('/api/staff/sessions?search='.str_repeat('a', 256))->assertUnprocessable()
            ->assertJsonPath('error.code', 'validation_failed')->assertJsonPath('error.details.search', ['max']);
    }

    /** @return array<string, array{string}> */
    public static function roles(): array
    {
        return ['Staff' => ['staff'], 'Administrator' => ['admin']];
    }

    #[DataProvider('roles')]
    public function test_staff_and_administrators_see_the_photo_of_an_active_visit(string $role): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('photos/camila.jpg', 'jpeg bytes');
        $user = User::factory()->create();
        $authorization = Authorization::factory()->manual()->create(['user_id' => $user->id, 'photo_path' => 'photos/camila.jpg']);
        $session = FacilitySession::factory()->startedMinutesAgo(20)->create(['user_id' => $user->id, 'authorization_id' => $authorization->id]);

        $response = $this->asStaff("/api/staff/sessions/{$session->id}/photo", $role)->assertOk();

        $this->assertSame('jpeg bytes', $response->streamedContent());
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_a_finished_visit_or_one_without_a_photo_shows_no_photo(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('photos/old.jpg', 'jpeg bytes');
        $authorization = Authorization::factory()->manual()->create(['photo_path' => 'photos/old.jpg']);
        $ended = FacilitySession::factory()->startedMinutesAgo(50)->checkedOut(20)->create([
            'user_id' => $authorization->user_id, 'authorization_id' => $authorization->id,
        ]);
        $noPhoto = FacilitySession::factory()->startedMinutesAgo(5)->create();

        $this->asStaff("/api/staff/sessions/{$ended->id}/photo")->assertNotFound()->assertJsonPath('error.code', 'not_found');
        $this->flushSession();
        $this->asStaff("/api/staff/sessions/{$noPhoto->id}/photo")->assertNotFound();
        $this->flushSession();
        $this->asStaff('/api/staff/sessions/999999/photo')->assertNotFound();
    }

    public function test_sign_in_is_required(): void
    {
        $this->fromThePwa()->getJson('/api/staff/sessions')->assertUnauthorized();
        $this->fromThePwa()->getJson('/api/staff/sessions/1/photo')->assertUnauthorized();
    }

    public function test_a_user_sign_in_does_not_grant_staff_access(): void
    {
        $user = User::factory()->create(['current_session_id' => 'device']);
        $this->actingAs($user, 'web')->withSession(['user_session_id' => 'device'])->fromThePwa()
            ->getJson('/api/staff/sessions')->assertUnauthorized();
    }
}
