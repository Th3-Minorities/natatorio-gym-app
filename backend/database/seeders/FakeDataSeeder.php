<?php

namespace Database\Seeders;

use App\Models\AcademicTerm;
use App\Models\AuditLogEntry;
use App\Models\Authorization;
use App\Models\DailyVisitTotal;
use App\Models\EmailLink;
use App\Models\FacilityInformation;
use App\Models\FacilitySession;
use App\Models\Import;
use App\Models\ImportedMembership;
use App\Models\ManualVisitCount;
use App\Models\Notice;
use App\Models\RosterRecord;
use App\Models\ScheduleSlot;
use App\Models\Setting;
use App\Models\StaffAccount;
use App\Models\User;
use App\Models\WaiverAcceptance;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Fake data for every data model table, for development, demos and test evidence (issue #81).
 * Never real student, employee or payment data. Every staff account's password is "password".
 */
class FakeDataSeeder extends Seeder
{
    /** Fixed Authorization Numbers for the browser flow tests (#152): one unclaimed order per browser, one claimed, one expired. */
    public const FREE_AUTHORIZATION_NUMBERS = ['PRUEBA1', 'PRUEBA2'];

    public const CLAIMED_AUTHORIZATION_NUMBER = 'USADO01';

    public const EXPIRED_AUTHORIZATION_NUMBER = 'VENCIDO';

    /** The claimed order's account, with a current authorization and a photo, for the Check In flow tests. */
    public const CHECK_IN_EMAIL = 'pago-activo@example.com';

    /** The one active roster record nobody has claimed yet; registration finds this athlete. */
    public const FREE_STUDENT_NUMBER = '802000001';

    /** The student number of a claimed roster record, for the athlete registration flow test (#152). */
    public const CLAIMED_STUDENT_NUMBER = '802000002';

    /** Claimed under another account, with no account for the roster email: lookup refuses 802000003 (#152). */
    public const CLAIMED_WITHOUT_ACCOUNT_STUDENT_NUMBER = '802000003';

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Fake data is never seeded in production.');

            return;
        }

        $this->content();
        [$current, , $past] = $this->terms();
        [$admin, $staff] = $this->staff();
        $paid = $this->paidMembers($current);
        $athletes = $this->athletes($current);
        $manual = $this->manualGrant($current);
        $this->accessCases($current, $past);
        $this->storeOrderCases();
        $this->links();
        $this->browserTestUser();
        $this->signInData();
        $this->visits($paid, $athletes, $manual, $admin, $staff);
        $this->auditLog($admin, $staff);
    }

    private function content(): void
    {
        // The office's direct line, from the gym meeting (#62 question 24).
        Setting::create(['name' => 'contact_phone', 'value' => '265-3866']);

        Notice::factory()->count(2)->create();

        foreach (['rules', 'towel', 'footwear', 'machines', 'equipment'] as $topic) {
            FacilityInformation::factory()->create(['topic' => $topic]);
        }

        // Monday to Friday regular hours, Saturday morning for athletes only, and one closure.
        foreach (range(1, 5) as $weekday) {
            ScheduleSlot::factory()->create(['weekday' => $weekday, 'start_time' => '06:00', 'end_time' => '22:00']);
        }
        ScheduleSlot::factory()->create(['type' => 'athletes_only', 'weekday' => 6, 'start_time' => '08:00', 'end_time' => '12:00']);
        ScheduleSlot::factory()->dated()->create();
    }

    /** @return array{AcademicTerm, AcademicTerm, AcademicTerm} the term that contains today, the next one and the one that ended */
    private function terms(): array
    {
        $current = AcademicTerm::factory()->create([
            'name' => 'Término actual',
            'starts_on' => today()->subMonths(2)->toDateString(),
            'ends_on' => today()->addMonth()->toDateString(),
        ]);
        $next = AcademicTerm::factory()->create([
            'name' => 'Próximo término',
            'starts_on' => today()->addMonth()->addDay()->toDateString(),
            'ends_on' => today()->addMonths(5)->toDateString(),
        ]);
        $past = AcademicTerm::factory()->create([
            'name' => 'Término pasado',
            'starts_on' => today()->subMonths(8)->toDateString(),
            'ends_on' => today()->subMonths(2)->subDay()->toDateString(),
        ]);

        return [$current, $next, $past];
    }

    /** @return array{StaffAccount, StaffAccount} one Administrator and one front desk account */
    private function staff(): array
    {
        $admin = StaffAccount::factory()->admin()->create(['name' => 'Administradora de prueba', 'email' => 'admin@example.com']);
        $staff = StaffAccount::factory()->create(['name' => 'Recepción de prueba', 'email' => 'staff@example.com']);
        StaffAccount::factory()->count(2)->create();
        StaffAccount::factory()->deactivated()->create();

        return [$admin, $staff];
    }

    /** @return list<Authorization> six claimed orders; two more stay unclaimed */
    private function paidMembers(AcademicTerm $term): array
    {
        $import = Import::factory()->create(['file_name' => 'sync-de-prueba', 'created_count' => 8]);
        $groups = ['student', 'student', 'student', 'student', 'employee', 'employee', 'student', 'employee'];

        $fixed = [
            0 => ['authorization_number' => self::CLAIMED_AUTHORIZATION_NUMBER, 'email' => self::CHECK_IN_EMAIL],
            6 => ['authorization_number' => self::FREE_AUTHORIZATION_NUMBERS[0]],
            7 => ['authorization_number' => self::FREE_AUTHORIZATION_NUMBERS[1]],
        ];
        $orders = collect($groups)->map(fn (string $group, int $index) => ImportedMembership::factory()->create([
            'import_id' => $import->id,
            'academic_term_id' => $term->id,
            'member_group' => $group,
            ...$fixed[$index] ?? [],
        ]));

        return $orders->take(6)->map(function (ImportedMembership $order) use ($term) {
            $user = $this->userWithWaiver(['email' => $order->email], $order->name);

            return Authorization::factory()->paid($order)->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        })->all();
    }

    /** @return list<Authorization> four claimed roster records with matching accounts; one other claimed, one free, one removed */
    private function athletes(AcademicTerm $term): array
    {
        $records = RosterRecord::factory()->count(4)->sequence(['student_number' => self::CLAIMED_STUDENT_NUMBER], [], [], [])->create();
        // On the roster and unclaimed, with a fixed number so registration can be tried by hand.
        RosterRecord::factory()->create(['student_number' => self::FREE_STUDENT_NUMBER]);
        RosterRecord::factory()->removed()->create();

        $authorizations = $records->map(function (RosterRecord $record) use ($term) {
            $user = $this->userWithWaiver(['email' => $record->institutional_email], $record->name);

            return Authorization::factory()->athlete($record)->create(['user_id' => $user->id, 'academic_term_id' => $term->id]);
        })->all();

        $claimed = RosterRecord::factory()->create([
            'student_number' => self::CLAIMED_WITHOUT_ACCOUNT_STUDENT_NUMBER,
            'name' => 'Claimed athlete without account',
            'institutional_email' => 'claimed.athlete.without.account@upr.example',
        ]);
        Authorization::factory()->athlete($claimed)->create([
            'user_id' => $this->userWithWaiver(['email' => 'claimed-athlete-owner@example.com'], 'Claimed athlete owner')->id,
            'academic_term_id' => $term->id,
        ]);

        return $authorizations;
    }

    private function manualGrant(AcademicTerm $term): Authorization
    {
        $user = $this->userWithWaiver(['email' => 'concedido-manual@example.com'], 'Acceso manual de prueba');

        return Authorization::factory()->manual()->create([
            'user_id' => $user->id,
            'academic_term_id' => $term->id,
            'member_group' => 'employee',
            'photo_path' => null,
        ]);
    }

    /**
     * The access decision cases of objective 1 that the groups above do not cover (issue #81). Valid paid, valid athlete
     * and the unmatched records (two unclaimed orders, one free roster record, and the browser test user, who matches
     * nothing) already exist. Each denied case below is a User whose Check In must answer check_in_no_authorization.
     */
    private function accessCases(AcademicTerm $current, AcademicTerm $past): void
    {
        // Expired paid: a real order and authorization, but of a term that ended.
        $expired = ImportedMembership::factory()->create([
            'import_id' => Import::factory()->create(['file_name' => 'sync-de-prueba-pasado', 'created_count' => 1])->id,
            'academic_term_id' => $past->id,
            'paid_at' => today()->subMonths(5),
            'authorization_number' => self::EXPIRED_AUTHORIZATION_NUMBER,
            'name' => 'Pago vencido de prueba',
            'email' => 'pago-vencido@example.com',
        ]);
        Authorization::factory()->paid($expired)->create(['user_id' => $this->userWithWaiver(['email' => 'pago-vencido@example.com'], 'Pago vencido de prueba')->id, 'academic_term_id' => $past->id]);

        // Removed athlete: the roster row stays with removed_at and the authorization is revoked (REQ-F-22).
        $removed = RosterRecord::factory()->removed()->create(['name' => 'Atleta removido de prueba', 'institutional_email' => 'atleta-removido@example.com']);
        Authorization::factory()->athlete($removed)->create([
            'user_id' => $this->userWithWaiver(['email' => 'atleta-removido@example.com'], 'Atleta removido de prueba')->id,
            'academic_term_id' => $current->id,
            'status' => 'revoked',
            'reason' => 'removed from roster',
        ]);

        // Missing authorization: an account that finished registration steps but has no authorization at all.
        $this->userWithWaiver(['email' => 'sin-autorizacion@example.com'], 'Sin autorización de prueba');
    }

    /**
     * Store sync outcomes (REQ-F-22, REQ-F-28, REQ-F-98, REQ-F-99). A cancelled order revokes its authorization. An order dated
     * outside every term and an order that repeats an Authorization Number are never stored: the sync record lists them
     * as skipped, with only the order reference and the reason (E-149).
     */
    private function storeOrderCases(): void
    {
        $import = Import::factory()->create([
            'file_name' => 'sync-de-prueba-omitidos',
            'revoked_count' => 1,
            'skipped_count' => 2,
            'result' => ['skipped' => [
                ['order_reference' => 'WC-900001', 'reason' => 'paid date outside every term'],
                ['order_reference' => 'WC-900002', 'reason' => 'repeated authorization number'],
            ]],
        ]);
        $cancelled = ImportedMembership::factory()->create([
            'import_id' => $import->id,
            'order_status' => 'cancelled',
            'name' => 'Orden cancelada de prueba',
            'email' => 'orden-cancelada@example.com',
        ]);
        Authorization::factory()->paid($cancelled)->create([
            'user_id' => $this->userWithWaiver(['email' => 'orden-cancelada@example.com'], 'Orden cancelada de prueba')->id,
            'status' => 'revoked',
            'reason' => 'order cancelled',
        ]);
    }

    private function links(): void
    {
        $freeRecord = RosterRecord::query()
            ->whereNull('removed_at')
            ->whereNotIn('id', Authorization::query()->whereNotNull('roster_record_id')->select('roster_record_id'))
            ->firstOrFail();

        EmailLink::factory()->athleteRegistration()->create(['roster_record_id' => $freeRecord->id]);
        EmailLink::factory()->athleteLink()->create(['roster_record_id' => $freeRecord->id]);
        EmailLink::factory()->staffInvite()->create([
            'staff_account_id' => StaffAccount::factory()->create(['password' => null])->id,
        ]);
    }

    private function signInData(): void
    {
        $session = fn (?int $userId) => [
            'id' => Str::random(40),
            'user_id' => $userId,
            'ip_address' => '192.0.2.1',
            'user_agent' => 'Fake data',
            'payload' => base64_encode(serialize([])),
            'last_activity' => time(),
        ];

        DB::table('sign_in_sessions')->insert([
            $session(User::query()->value('id')),
            $session(null),
        ]);
        DB::table('staff_password_reset_tokens')->insert([
            'email' => 'staff@example.com',
            'token' => Hash::make(Str::random(40)),
            'created_at' => now(),
        ]);
    }

    /**
     * @param  list<Authorization>  $paid
     * @param  list<Authorization>  $athletes
     */
    private function visits(array $paid, array $athletes, Authorization $manual, StaffAccount $admin, StaffAccount $staff): void
    {
        foreach ([...$paid, ...$athletes, $manual] as $index => $authorization) {
            // Yesterday, checked out by the front desk.
            $this->visit($authorization)
                ->state(['started_at' => now()->subDay()->setTime(7 + $index, 0)])
                ->checkedOut(45)
                ->create(['checked_out_by_staff_account_id' => $staff->id]);
        }

        // Three people inside right now.
        foreach ([$paid[0], $athletes[0], $manual] as $authorization) {
            $this->visit($authorization)->startedMinutesAgo(20)->create();
        }

        $paperStart = now()->subDays(2)->setTime(9, 0);
        $this->visit($manual)
            ->state(['started_at' => $paperStart])
            ->checkedOut(45)
            ->create(['entered_by_staff_account_id' => $admin->id]);

        $voidStart = now()->subDays(3)->setTime(9, 0);
        $this->visit($manual)->create([
            'status' => 'void',
            'started_at' => $voidStart,
            'ends_at' => $voidStart->copy()->addHours(2),
            'ended_at' => $voidStart->copy()->addMinutes(10),
            'entered_by_staff_account_id' => $admin->id,
        ]);

        $expiredStart = now()->subDays(4)->setTime(9, 0);
        $this->visit($athletes[1])->create([
            'status' => 'expired',
            'started_at' => $expiredStart,
            'ends_at' => $expiredStart->copy()->addHours(2),
            'ended_at' => null,
        ]);

        $earlyStart = now()->subDays(4)->setTime(12, 0);
        $this->visit($paid[2])
            ->state(['started_at' => $earlyStart])
            ->endedEarly(30)
            ->create();

        // Paper log counts for people without an account (E-132), and a week of daily totals.
        ManualVisitCount::factory()->count(2)->create(['entered_by_staff_account_id' => $staff->id]);

        foreach (range(1, 7) as $daysAgo) {
            DailyVisitTotal::factory()->create(['day' => today()->subDays($daysAgo)->toDateString()]);
        }
    }

    /** A visit that copies the type, group and sport of its authorization, like Check In does. */
    private function visit(Authorization $authorization): Factory
    {
        $factory = match ($authorization->type) {
            'paid' => FacilitySession::factory()->paid($authorization->importedMembership->member_group),
            'athlete' => FacilitySession::factory()->athlete($authorization->rosterRecord->sport),
            'manual' => FacilitySession::factory()->state(['authorization_type' => 'manual', 'member_group' => $authorization->member_group]),
        };

        return $factory->state(['user_id' => $authorization->user_id, 'authorization_id' => $authorization->id]);
    }

    private function auditLog(StaffAccount $admin, StaffAccount $staff): void
    {
        AuditLogEntry::factory()->count(3)->create(['staff_account_id' => $admin->id]);
        AuditLogEntry::factory()->count(2)->create(['staff_account_id' => $staff->id]);
    }

    /**
     * The name shown in the app is the waiver's full name, so it always belongs to the same person as the email.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function userWithWaiver(array $attributes = [], ?string $name = null): User
    {
        $user = User::factory()->create($attributes);
        WaiverAcceptance::factory()->create(array_filter(['user_id' => $user->id, 'email' => $user->email, 'full_name' => $name]));

        return $user;
    }

    private function browserTestUser(): User
    {
        return User::factory()->create([
            'email' => env('E2E_USER_EMAIL', 'user@example.com'),
            'password' => Hash::make(env('E2E_USER_PASSWORD', 'test-user-password-129')),
            'locale' => 'es',
        ]);
    }
}
