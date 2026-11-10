# Test plan for objectives 1 to 3

Each case of the proposal's testing plan for objectives 1 to 3, the requirement it proves, the seeded data it uses and the tests that pass it (REQ-NF-44). Issue #81.

The full flows, screen by screen, are in `flow-results.md` (#152). This page answers a different question: for each case the proposal promised, which test proves it.

## How to run it

Load the seeded data into a fresh local database, then run the backend and browser tests:

```powershell
docker compose exec app php artisan migrate:fresh --seed
docker compose exec app php artisan test
cd frontend
npx vitest run
npx playwright test --workers=1
```

The seeder never runs in production. Every seeded password is `password`. The seeded hours are Monday to Friday, 6:00 to 22:00, Puerto Rico time.

## Seeded people for each access case

| Case | Seeded account | What it has |
|---|---|---|
| Valid paid membership | the first paid members of the current term, such as the ones on S-01 | an active paid authorization in the current term |
| Expired paid membership | `pago-vencido@example.com` | a paid authorization of a term that ended |
| Valid athlete | the athletes of the current term | an active athlete authorization, a 9-digit student number on the roster |
| Invalid athlete | `atleta-removido@example.com` | removed from the roster, authorization revoked with "removed from roster" |
| Missing authorization | `sin-autorizacion@example.com` | an account with a waiver and no authorization |
| Cancelled order | `orden-cancelada@example.com` | the store order was cancelled and its authorization revoked |
| Unmatched record | any Authorization Number or student number not in the store or the roster | nothing to match, so registration refuses it |

## Results

Result words: pass, fail. The results come from the run in `evidence/summary.md`, which has the date, the commit and the saved reports. Run it again with `npm run evidence` from `frontend/`.

### Objective 1: one correct access decision

Acceptance criterion: every defined authorization case returns the expected decision; valid authorizations are approved and the rest are denied (Proposal, Project Objectives).

| Case | Expected decision | Requirement | Tests | Result |
|---|---|---|---|---|
| Valid paid membership | approved: the account has a current authorization and Check In creates a visit | REQ-NF-40 | `DatabaseSeederTest::the_denied_access_cases_have_no_current_authorization_and_the_valid_ones_do`, `CheckInTest::a_valid_check_in_creates_one_session_with_the_authorization_copied` | pass |
| Expired paid membership | denied: no current authorization | REQ-NF-40 | `DatabaseSeederTest::the_denied_access_cases_have_no_current_authorization_and_the_valid_ones_do`, `CheckInTest::a_revoked_or_ended_authorization_is_no_authorization`, `PaidRegistrationTest::invalid_claimed_and_ended_numbers_have_identical_responses` | pass |
| Valid athlete | approved: on the roster, Check In creates a visit with the sport | REQ-NF-40 | `DatabaseSeederTest::the_denied_access_cases_have_no_current_authorization_and_the_valid_ones_do`, `CheckInTest::an_athlete_session_copies_the_sport`, `PaidRegistrationTest::a_student_number_on_the_roster_and_unclaimed_is_an_athlete` | pass |
| Invalid athlete | denied: removed from the roster, no current authorization | REQ-NF-40 | `DatabaseSeederTest::the_denied_access_cases_have_no_current_authorization_and_the_valid_ones_do`, `PaidRegistrationTest::a_student_number_not_on_the_roster_or_removed_gets_the_contact_number`, `AthleteRegistrationTest::a_removed_roster_record_is_refused_even_when_its_email_has_an_account` | pass |
| Missing authorization | denied: Check In answers "no authorization" | REQ-NF-40 | `DatabaseSeederTest::the_denied_access_cases_have_no_current_authorization_and_the_valid_ones_do`, `CheckInTest::no_authorization` | pass |
| Unmatched record | denied: the number matches no store order or roster record | REQ-NF-40 | `PaidRegistrationTest::invalid_claimed_and_ended_numbers_have_identical_responses`, `PaidRegistrationTest::a_student_number_not_on_the_roster_or_removed_gets_the_contact_number` | pass |
| Cancelled order | denied: its authorization is revoked | REQ-NF-40 | `DatabaseSeederTest::the_denied_access_cases_have_no_current_authorization_and_the_valid_ones_do` | pass |
| A number claimed twice at the same moment | one claim, one account | REQ-NF-42 | `ConcurrentInsertsTest::two_claims_of_the_same_membership_at_the_same_time`, `ConcurrentInsertsTest::two_claims_of_the_same_roster_record_in_the_same_term_at_the_same_time`, `PaidRegistrationConcurrencyTest::two_simultaneous_claims_create_exactly_one_account_and_keep_only_its_photo`, `PaidRegistrationConcurrencyTest::two_simultaneous_athlete_link_claims_create_exactly_one_account_and_keep_only_its_photo` | pass |

### Objective 2: Check In and sessions

The proposal names a 60-minute visit. The team replaced it with check-out at the desk or an automatic close 2 hours after Check In (E-115), so the cases below test the 2-hour rule.

| Case | Expected result | Requirement | Tests | Result |
|---|---|---|---|---|
| Inside the gym boundary | accepted, one visit created | REQ-NF-40 | `CheckInTest::a_valid_check_in_creates_one_session_with_the_authorization_copied` | pass |
| Outside the boundary | refused with its own code | REQ-NF-40 | `CheckInTest::outside_the_boundary`, `CheckInTest::the_boundary_comes_from_the_configuration` | pass |
| Location permission denied | the screen explains it and offers to try again | REQ-NF-43 | `CheckIn.test.tsx`: "shows a denied location permission with retry and help (4433:4364)" and "asks for location again and continues the Check In from the denied screen" | pass |
| Poor location accuracy | refused with its own code | REQ-NF-40 | `CheckInTest::low_accuracy` | pass |
| No location sent | refused, asked for the location | REQ-NF-40 | `CheckInTest::location_required` | pass |
| Accepted Check In | one visit with the authorization copied | REQ-NF-40, REQ-NF-41 | `CheckInTest::a_valid_check_in_creates_one_session_with_the_authorization_copied` | pass |
| Rejected Check In | refused in the decided order: authorization, photo, photo pending, gym closed, athletes only, location | REQ-NF-40 | `CheckInTest::checks_run_in_the_decided_order`, `CheckInTest::photo_required`, `CheckInTest::photo_pending`, `CheckInTest::gym_closed_with_no_hours_now`, `CheckInTest::athletes_only_rejects_paid_and_manual_members_with_the_period` | pass |
| Repeated Check In | the open visit is returned, no second one | REQ-NF-40 | `CheckInTest::an_active_session_is_returned_without_location_or_any_other_check` | pass |
| Check-out at the desk | the visit ends at that moment | REQ-NF-40 | `CheckOutTest::staff_and_administrators_check_out_without_an_audit_entry`, `CheckOutTest::only_active_sessions_can_be_checked_out` | pass |
| Automatic close after 2 hours | the visit ends at 2 hours, also before the scheduled task runs | REQ-NF-40 | `SessionCloseTest::the_scheduled_task_closes_exactly_due_sessions_and_is_idempotent`, `CheckInTest::a_session_past_its_two_hours_is_not_active_even_before_the_cleanup_task`, `CheckOutTest::exactly_two_hours_is_already_ended` | pass |
| Two Check Ins at the same moment | one visit only | REQ-NF-42 | `CheckInConcurrencyTest::a_simultaneous_check_in_returns_the_session_that_won`, `ConcurrentInsertsTest::two_check_ins_of_the_same_user_at_the_same_time` | pass |
| Sign in to visit created | a User signs in and Checks In through the real API | REQ-NF-41 | `e2e/user-sign-in.spec.ts`, and the Check In flow in `e2e/flows/check-in.spec.ts` | pass |

### Objective 3: occupancy

| Case | Expected result | Requirement | Tests | Result |
|---|---|---|---|---|
| The count goes up after a Check In | the visit counts while it is open | REQ-NF-40 | `OccupancyTest::counts_only_non_void_ranges_containing_now_with_an_exclusive_end`, `StaffAssistedCheckInTest::staff_enter_a_person_without_a_phone_and_the_log_marks_it` | pass |
| The count goes down after check-out or the 2-hour close | ended visits do not count | REQ-NF-40 | `OccupancyTest::counts_only_non_void_ranges_containing_now_with_an_exclusive_end` | pass |
| The count goes down after a Staff correction | ending early or voiding removes the visit from the count | REQ-NF-40 | `StaffSessionDetailTest::staff_correct_an_active_visit_and_the_log_names_them` | pass |
| Closures and the term end | the visit stops counting before the scheduled task runs | REQ-NF-40 | `OccupancyTest::a_closure_that_started_drops_out_before_the_scheduler_runs`, `OccupancyTest::a_term_that_ended_drops_out_before_the_scheduler_runs` | pass |
| An empty gym | 0 is a real count | REQ-NF-40 | `OccupancyTest::empty_gym_has_zero_occupancy` | pass |
| User, Staff and Administrator see the same number | the staff route answers exactly what the User route answers, and the S-01 list matches the count | REQ-F-42 | `StaffOccupancyTest::staff_and_administrators_see_the_same_answer_as_users`, `StaffSessionsListTest::the_list_and_occupancy_agree` | pass |
| Concurrent events | two Check Ins at the same moment count once | REQ-NF-42 | `CheckInConcurrencyTest::a_simultaneous_check_in_returns_the_session_that_won` | pass |
| Every screen updates the number | Gimnasio and S-01 poll every 25 seconds while visible, and S-01 updates at once after a check-out | REQ-F-43 | `GymId.test.tsx`: "shows the count, polls after 25 seconds and links the selected tab"; `SessionsList.test.tsx`: "updates the occupancy card at once after a check-out, without waiting for the next poll" | pass |

## Not covered here

- Check In on real phones through the tunnel (REQ-NF-43): the manual column of `flow-results.md`.
- The load test (REQ-NF-50): #83.
- Objectives 4 and 5 (roles and analytics): later issues.
