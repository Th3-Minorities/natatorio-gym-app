# Flow test results

Results of issue #152: every flow in the midterm scope, from its first screen to its last. Each flow has one automated browser test in `frontend/e2e/flows/`, which runs in CI with the other browser tests on the seeded test data. The Manual column is for the run on real phones: an iPhone with Safari and an Android phone with Chrome, or a desktop browser for the Staff and Administrator flows. Every flow also has a path table in [flow-paths.md](flow-paths.md): one row per path, tested with a test technique, on each device.

## How to run them

The tests use the fake data of the database seeder, and the paid registration test claims an Authorization Number, so start from a fresh seed:

```powershell
docker compose exec app php artisan migrate:fresh --seed
cd frontend
npx playwright test e2e/flows --workers=1
```

Seeded data the tests and the manual check use (every password is `password` unless the row says otherwise):

| Data | Value |
|---|---|
| Student number on the roster, unclaimed | `802000001` |
| Student number of a claimed roster record whose email has no account | `802000003` |
| Unclaimed Authorization Numbers | `PRUEBA1` (Chromium), `PRUEBA2` (Edge) |
| Claimed Authorization Number | `USADO01` |
| Authorization Number of a term that ended | `VENCIDO` |
| Member with a current paid authorization | `pago-activo@example.com` |
| Member whose paid term ended | `pago-vencido@example.com` |
| User for sign-in | `user@example.com`, password `test-user-password-129` |
| User for the forgotten password | `sin-autorizacion@example.com` (the test sets a new password each run) |
| Administrator and Staff | `admin@example.com`, `staff@example.com` |
| Gym location | latitude 18.2110, longitude -67.1410 |

The seeded hours are Monday to Friday, 6:00 to 22:00, Puerto Rico time. Outside them every Check In gets "El gimnasio está cerrado", which would make the Check In, Gym ID and end of visit tests skip their steps. So the test database gets one special-hours row that keeps the gym open from a day before to a day after the moment it is added. The CI workflow adds it in the step that seeds the database (`.github/workflows/frontend.yml`), right after `db:seed`, and it is not part of the demo seed. For a local run, add it the same way after `migrate:fresh --seed`:

```powershell
docker compose exec app php artisan tinker --execute="App\Models\ScheduleSlot::factory()->create(['type' => 'special_hours', 'weekday' => null, 'start_time' => null, 'end_time' => null, 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(), 'text_es' => 'Horario abierto de las pruebas de flujo.']);"
```

Without the row the tests still check the closed answer and skip the later steps, as they would in a run outside the hours. An athletes-only period (Saturday 8:00 to 12:00) still keeps members out, with or without the row, so the Check In step for it is not automated.

Result words: pass, fail, skipped (with the reason in the row), not built (the screen is not on `main` yet), not automated (only a real phone can do it), pending (not run yet).

The CI column holds the Frontend workflow run of 2026-11-09 on this branch, commit `64c5646` ([run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653)). The user app flows ran in the Android (Pixel 7) and iPhone (iPhone 13) browser jobs, the dashboard flows in the Chrome, Edge, Firefox and Safari jobs, each with `--workers=1` and two retries. The workflow seeds the database and adds the special-hours row, so the Check In, Gym ID and end of visit tests run at any hour. A step is pass when its test passed on every device of its flow. No step failed. The rows marked skipped below are not run by any test in CI.

## Run 2026-11-10

Full run of the path tests on the kim stack, branch `152-flow-e2e-tests`. Sections 9 to 11 use a Run column with the result of this run, since those path tests live in `frontend/e2e-paths/` and CI does not run them.

- kim-014 fixed: `7b3dff1` on this branch, in `main` through #177.
- kim-015 fixed: `79775d1`.
- SA-02 and SA-91 updated for S-01 (`51c065e`).
- AR-40 passed 3 of 3 on a clean stack.
- CI-10 on iPhone and `StaffChanges.test.tsx` were flaky under load and pass alone.
- Paid registration on iPhone failed only because projects sharing one local stack spend the 10 failed lookups per 15 minutes together. It passes after clearing the cache. CI gives each project its own stack.

## 1. Paid member registration

Test: `paid-registration.spec.ts`

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Android and iPhone browser jobs. Paths: [flow-paths.md](flow-paths.md#1-paid-member-registration). Bugs the path tests found, fixed and retested: PR-23 ([Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19487648), fixed in `1c12007`).

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Open Welcome, tap or swipe the sheet, and tap Comenzar | none | "Antes de comenzar" with the privacy notice | pass | pending |
| 2 | Tap Continuar con el registro | none | Number entry screen, "Registro" | pass | pending |
| 3 | Enter an expired number | `VENCIDO` | "No pudimos validar este número. Revisa tu recibo o llama al 265-3866.", the field now says "Número de autorización", and the help line "Ayuda: 265-3866" shows | pass | pending |
| 4 | Enter an already used number | `USADO01` | Same message as step 3 | pass | pending |
| 5 | Enter a valid number | `PRUEBA1` or `PRUEBA2` | "¡Hola, [name]!" and "Crea una contraseña" | pass | pending |
| 6 | Enter and confirm a password | 10 or more characters | Photo step, Continuar disabled until a photo is chosen | pass | pending |
| 7 | Take a photo | a PNG through the camera input | Photo preview | pass | pending |
| 8 | Upload a photo instead | a PNG through Subir foto | Photo preview with the new photo, Continuar enabled | pass | pending |
| 9 | Tap Crear cuenta with nothing filled | none | Errors on the waiver box, contact name and phone | pass | pending |
| 10 | Open Leer relevo completo and go back | none | "Relevo" with the draft text, then back to the form | pass | pending |
| 11 | Accept the waiver, fill the emergency contact | `Contacto de Prueba`, `787-555-0100` | Form ready | pass | pending |
| 12 | Tap Crear cuenta while the save fails | API answer replaced once with a server error | "No pudimos crear tu cuenta", then Volver a mi foto keeps the photo, waiver and contact | pass | pending |
| 13 | Tap Crear cuenta again | none | Install help, "Instala la app" | pass | pending |
| 14 | Choose iPhone and tap Continuar | none | Check In, "Miembro" with the active authorization badge | pass | pending |

## 2. Athlete registration

Test: `athlete-registration.spec.ts`. It covers the student number lookup, the emailed link and the account it creates. The API allows 10 failed lookups per IP in 15 minutes, so only the desktop path runs look up the numbers that fail (steps 1 to 3). In CI the seeded student number `802000001` can have a link less than 300 seconds old, so step 4 can answer "Espera para pedir otro enlace" instead, and the test accepts both. Only a local stack makes a new roster record per run, so only there the test goes on to step 6.

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Android and iPhone browser jobs. Paths: [flow-paths.md](flow-paths.md#2-athlete-registration). Bugs the path tests found, fixed and retested: AR-20 ([Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19490187), fixed in `7dcd4c0`); AR-34 ([Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19490192), fixed in `7dcd4c0`); AR-22 ([Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19490197), fixed in `7dcd4c0`).

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Enter a student number that is not on the roster | `900000000` | "Revisa tu número", "No apareces en la lista de atletas. Consulta al Departamento de Actividades Atléticas: 265-3866.", Ver ejemplo del recibo and Corregir número | skipped: lookup limit, run by the path tests | pending |
| 2 | Enter a student number already claimed | `802000003` | "Revisa tu registro", "Este registro no está disponible para crear otra cuenta.", Iniciar sesión and Cambiar número | skipped: lookup limit, run by the path tests | pending |
| 3 | Enter 8 digits | `80200000` | Looked up as an Authorization Number: "No pudimos validar este número. Revisa tu recibo o llama al 265-3866." | skipped: lookup limit, run by the path tests | pending |
| 4 | Enter a student number on the roster, unclaimed | `802000001` | "Revisa tu correo", "Enviamos un enlace a tu correo institucional.", and the Reenviar en 04:xx button disabled | pass | pending |
| 5 | Open the email link | the link in the email to the roster address | "Antes de comenzar", then "Crea una contraseña" with "¡Hola, [name]!" | pass | pending |
| 6 | Enter a password, add a photo, accept the waiver, fill the emergency contact, tap Crear cuenta | `una frase larga para el registro de prueba`, a PNG, `Contacto de Prueba`, `787-555-0100` | Install help, "Instala la app" | skipped: needs a new roster record per run, only on a local stack | pending |
| 7 | Tap Soy atleta in Mi cuenta to add athlete access to an existing account | none | Not built: the row does nothing on `main` | not built | not built |

## 3. User sign in

Test: `user-sign-in.spec.ts`

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Android and iPhone browser jobs. Paths: [flow-paths.md](flow-paths.md#3-user-sign-in). Bugs the path tests found, fixed and retested: SI-50 ([Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19488756), fixed in `d3d1eef`).

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Sign in with a wrong password | `user@example.com` | Both fields marked and "Correo o contraseña incorrectos." under the password, still on Sign in | pass | pending |
| 2 | Sign in with the right password | `user@example.com` | Mi cuenta | pass | pending |
| 3 | Tap Check-in in the navigation | none | Check In with the hold button | pass | pending |
| 4 | Sign in on a second phone, reload the first | same account | First phone: Sign in with "Iniciaste sesión en otro dispositivo" | pass | pending |
| 5 | Tap ¿Olvidaste tu contraseña? and send the link | `sin-autorizacion@example.com` | "Solicitud recibida" | pass | pending |
| 6 | Open the email link and save a new password | a new long password | Back to Sign in | pass | pending |
| 7 | Sign in with the new password | same account | Mi cuenta, "Sin autorización activa" | pass | pending |

## 4. Check In

Test: `check-in.spec.ts`

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Android and iPhone browser jobs. Paths: [flow-paths.md](flow-paths.md#4-check-in). Bugs the path tests found, fixed and retested: CI-66 ([issue #17 comment](https://github.com/Th3-Minorities/natatorio-gym-app/issues/17#issuecomment-6735515910), fixed in `8d1c3f7`); CI-18 ([issue #17 comment](https://github.com/Th3-Minorities/natatorio-gym-app/issues/17#issuecomment-6735696177), fixed in `8d1c3f7`).

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Hold Check In with no current authorization | `pago-vencido@example.com`, inside the gym | "Tu acceso no está vigente", Revisar mi acceso goes to Mi cuenta | pass | pending |
| 2 | Hold Check In with location denied | `pago-activo@example.com` | "Activa el permiso de ubicación", the help opens and closes | pass | pending |
| 3 | Tap Reintentar with poor accuracy | 500 m accuracy | "Necesitamos mayor precisión" | pass | pending |
| 4 | Tap Intentar de nuevo outside the gym | about 1 km away | "Acércate al gimnasio" | pass | pending |
| 5 | Tap Intentar de nuevo inside the gym | gym location | "¡Tu entrada quedó registrada!", Gym ID with "Sesión activa" and "Estudiante" | pass | pending |
| 6 | Check In again | same account | Same visit, same entry time | pass | pending |
| 7 | Hold Check In as a member in an athletes-only period | Saturday 8:00 to 12:00 | "Ahora entrenan los atletas" | skipped: needs the server clock in that period | pending |

## 5. Gym ID and occupancy

Test: `gym-id-occupancy.spec.ts`

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Android and iPhone browser jobs. Paths: [flow-paths.md](flow-paths.md#5-gym-id-and-occupancy). Bugs the path tests found, fixed and retested: GI-07 ([Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19501881), fixed in `34508d1`).

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Open Gimnasio | `pago-activo@example.com` | Count, level (Baja, Moderada, Alta by thirds of 40) and update time | pass | pending |
| 2 | Check In from inside the gym | gym location | Gym ID: "Sesión activa", "Entrada registrada", "Duración" | pass | pending |
| 3 | Lose the connection | offline | "No válida ahora" and "Restablece la conexión para validar tu tarjeta." | pass | pending |
| 4 | Get the connection back | online | "Sesión activa" again | pass | pending |
| 5 | Open Gimnasio | none | Count one higher than step 1 | pass | pending |
| 6 | Front desk check-out, reload Gimnasio | the Staff API (the desk screen is not built) | Count back to step 1 | pass | pending |

## 6. End of a visit

Test: `end-of-visit.spec.ts`

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Android and iPhone browser jobs. Paths: [flow-paths.md](flow-paths.md#6-end-of-a-visit). No bug found by the path tests.

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Check In from inside the gym | `pago-activo@example.com` | Gym ID, "Sesión activa" | pass | pending |
| 2 | Front desk check-out | the Staff API (the desk screen is not built) | Visit ended | pass | pending |
| 3 | Reload the phone | none | "Tu visita ha terminado", "Sesión finalizada", entry, exit, total duration, "Tu salida fue registrada por el personal." | pass | pending |
| 4 | Tap Continuar | none | Check In ready for the next visit | pass | pending |
| 5 | Wait 2 hours after a Check In | none | "La sesión se cerró automáticamente." | skipped: needs the server clock 2 hours ahead | pending |
| 6 | Reach the end of the term during a visit | none | The visit ends | skipped: needs the server clock at the term end | pending |

## 7. App base

Test: `app-base.spec.ts`

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Android and iPhone browser jobs. Paths: [flow-paths.md](flow-paths.md#7-app-base). No bug found by the path tests.

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Open the install help | none | "Instalar app", the Android tab on Android and the iPhone tab on an iPhone | pass | pending |
| 2 | Choose iPhone | none | Safari steps, Volver a Mi cuenta goes to Mi cuenta | pass | pending |
| 3 | Read the manifest | none | "Gym RUM", standalone, starts at Mi cuenta | pass | pending |
| 4 | Open the install help in the installed app | iOS standalone flag | "¡Todo listo!" | pass | pending |
| 5 | Install on iPhone and Android | real phones | App icon on the home screen, opens full screen | not automated | pending |
| 6 | Open the app with no connection | offline | Welcome (collapsed) and the install help open | pass | pending |

## 8. Staff accounts

Test: `staff-accounts.spec.ts`

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Chrome, Edge, Firefox and Safari browser jobs. Paths: [flow-paths.md](flow-paths.md#8-staff-accounts). No bug found by the path tests.

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Sign in with a wrong password, then the right one | `admin@example.com` | "No pudimos iniciar sesión", then the dashboard as Administrador | pass | pending |
| 2 | Sign out | none | Sign in | pass | pending |
| 3 | Invite a person as Staff | a new `e2e-flow-...@example.com` | "Invitación enviada", row "Invitado" | pass | pending |
| 4 | Open the invitation email, create a password, sign in | the new account | Dashboard as Staff, without Cuentas del staff | pass | pending |
| 5 | Forgotten password: send the link, open it, save a new password, sign in | the new account | "Revisa tu correo", "Contraseña guardada", dashboard | pass | pending |
| 6 | Change the role to Administrador | the new account | "Rol cambiado", row shows Administrador | pass | pending |
| 7 | Deactivate, then try to sign in | the new account | Row "Desactivado", sign-in refused with "Cuenta desactivada" | pass | pending |

## 9. Terms and athlete roster

Tests: `terms-roster.spec.ts` (TR-01 to TR-21, TR-N) and `cross-device-roster.spec.ts` (TR-X). Paths TR-01 to TR-21 are in [flow-paths.md](flow-paths.md#9-terms-and-athlete-roster). The CI flow test `frontend/e2e/flows/terms-roster.spec.ts` is still skipped. The screens are now built: A-04 (Términos), A-05 (Gestionar atletas) and S-05 (Roster de atletas), with the Word and PDF download. The paths run on the desktop project (the dashboard is desktop only, E-171); the TR-X rows also open their own phone, named in the title (android is a Pixel 7, iphone is an iPhone 13). Bugs found by these paths: none.

### 9a. A-04, A-05, S-05 and the roster download

| Path | Test | Expected result | Run | Manual |
|---|---|---|---|---|
| TR-N01 | an Administrator adds a term on A-04: it appears as Próximo, a confirmation shows and one audit entry holds the dates | Row `Próximo` with both dates; card `<name> se guardó.`; one audit entry `term.create` with the dates (admin-flows 8 T9, E-187) | pass | pending |
| TR-N02 | term name boundaries: 50 characters save, a 51st cannot be typed, 51 sent to the API and an empty name are refused | 50 saved; the input stops at 50; API 422 `validation_failed`; empty gives `Este campo es obligatorio.` on the name. Column is 50 characters (data model); no SRS text | pass | pending |
| TR-N03 | term date boundaries: a one-day term saves, a start after the end, empty dates and 31 February are refused | One-day term saved; reversed gives `Revisa el orden de las fechas` and `Corregir fechas` returns to the start date; empty dates give two required errors; 31 Feb is 422 (admin-flows 8 T2) | pass | pending |
| TR-N04 | term overlap boundaries: a one-day overlap, a term inside another and an identical one are refused with the other term named; adjacent and gap save | First three refused with `Las fechas coinciden con otro término` naming the other term; adjacent and gap saved (REQ-F-21, admin-flows 8 T4-T5) | pass | pending |
| TR-N05 | shortening a term end is never blocked: the row and the audit entry change, and its authorizations stay active in the term | Edit note `Las autorizaciones terminan el <date>`; saved even though the authorization is affected; audit `term.update` with the end date before and after; the authorization stays active in its term (E-88, REQ-F-22) | pass | pending |
| TR-N06 | editing a term into the dates of another is refused naming the other term; the row keeps its dates | Refused naming the other term; row and audit unchanged (admin-flows 8) | pass | pending |
| TR-N07 | terms are for Administrators: Staff get 403 forbidden on the API and no screen, a signed-out call gets 401 | Staff: no A-04 screen, no request, API 403 `forbidden`; signed out: 401 (role table line 49, REQ-F-52) | pass | pending |
| TR-N08 | terms are never deleted: A-04 has no delete action and DELETE on a term is refused | None on screen; DELETE answers 404 or 405; term still there (REQ-F-21, E-107) | pass | pending |
| TR-N09 | with no term today A-04, A-05 and A-15 each show the Sin término activo notice with its reason | Each shows the `Sin término activo` notice with its reason (admin-flows 9 N7, D9, screen-map line 317) | pass | pending |
| TR-N10 | the quick form keeps the sport and empties the rest after each save, shows the sport large, and writes one audit entry per athlete | Form stays open; sport kept and shown as `Añadiendo atletas de: <sport>`; other fields empty; `Atleta guardado`; one audit `roster.add` per record (admin-flows 10 A3, D10, E-139) | pass | pending |
| TR-N11 | roster field boundaries: 9 digits save, 8 or 10 digits, letters, a bad email, empty fields and over-long text are refused | 9 digits only (E-160); the rest 422 with that field named; 255 and 50 saved; form shows `Escribe el número completo, solo con dígitos.`, `Escribe un correo electrónico válido.`, four required errors | pass | pending |
| TR-N12 | a repeated student number, even one of a withdrawn athlete, is refused naming the athlete who has it | `Este número ya está en el roster` naming the holder; nothing added (REQ-F-51, admin-flows 10 V1) | pass | pending |
| TR-N13 | two Administrators adding the same student number at once: one is saved, the other is refused | One 201, one 422 `roster_student_number_taken`; one record (REQ-F-51) | pass | pending |
| TR-N14 | Staff see the roster read only on S-05: search by name and number, no email, no add, edit, remove or download, and 403 on every write | Read only list with `Solo lectura`, count, no email column or text, no add, edit, remove, restore or download; withdrawn hidden; every write and download 403 `forbidden`; `status=withdrawn` ignored (REQ-F-49, role table lines 47-55, D16) | pass | pending |
| TR-N15 | an Administrator edits an athlete: the row and the audit entry hold the changes, and a repeated student number is refused | Saved, card, audit `roster.update` with only the changed fields; the repeated number is refused and nothing changes (admin-flows 10 A4, V1) | pass | pending |
| TR-N16 | withdrawing a record with no account: confirm text, confirmation card, hidden from the default list and from Staff, shown with Retirado, one audit entry | Confirm text says the Gym ID stops at once; card `se retiró del roster`; hidden from the default list and from Staff search; `Retirado` filter shows it with `Restituir`; one audit entry (admin-flows 11 R1, R8) | pass | pending |
| TR-N19 | reinstate needs a reason of 10 characters: empty and 9 are refused with a counter, 10 is accepted and the audit entry holds it | Empty and 9 refused with `El motivo debe tener al menos 10 caracteres` and the counter; 10 accepted, authorization active, audit `roster.reinstate` with the reason (E-86, E-95, REQ-F-49) | pass | pending |
| TR-N20 | reinstate is refused when the athlete already has an active authorization in the term, and the record stays withdrawn | `Ya tiene una autorización activa` naming the term; stays withdrawn; no audit entry (E-94, REQ-F-49) | pass | pending |
| TR-N22 | the Word download holds the title, the date line, the counter and every athlete with name, sport, number, email and status, accents and symbols intact | File `roster-atletas-<date>.docx` with title, `Generado el ...` line, counter, header and every athlete with name, sport, number, email, status; symbols intact; confirmation card (REQ-F-100, E-140) | pass | pending |
| TR-N23 | the PDF download holds the title, the date line and every athlete, and the API sends it as a private PDF attachment | PDF with title, date line, counter, every number, `Retirado`, accents; API sends `application/pdf`, attachment, `no-store`, `%PDF-`; `format=xls` 422 | pass | pending |
| TR-N24 | a roster of about 100 athletes downloads complete in Word and in PDF, the PDF over several pages | Word has every row; PDF spans several pages and holds every number (REQ-F-100). An empty roster file cannot be made without deleting seeded data: not run | pass | pending |
| TR-N25 | the download lists withdrawn athletes as Retirado next to active ones as Activo (SRS REQ-F-100, widened by E-190) | The withdrawn athlete is listed with `Retirado`, an active one with `Activo` (REQ-F-100, widened by E-190). The old open question is closed by the SRS | pass | pending |
| TR-N27 | A-04 without connection or on a server error offers Reintentar, and a form open when the connection drops keeps what was typed and cannot save until it is back | `Sin conexión` then `Error al cargar` with `Reintentar`; the form keeps its text, shows the offline note and cannot save until the connection is back (screen-map line 318) | pass | pending |
| TR-N28 | A-05 without connection or on a server error offers Reintentar, and a list on screen turns read only until the connection is back | Same states; add and download disabled offline (screen-map line 319) | pass | pending |
| TR-N29 | S-05 keeps the old rows marked as not current while offline, with the search and Check in disabled, and shows an error with Reintentar on a server error | `Error al cargar roster`; offline: old rows marked `Datos no actuales`, search and `Check in` disabled (screen-map line 309) | pass | pending |
| TR-N30 | the terms list marks each term Activo, Próximo or Finalizado by today, hides finished ones behind a toggle and names the active one | Statuses `Activo`, `Próximo`, `Finalizado` by today; active term named in the chip; finished ones behind the toggle; API status matches | pass | pending |
| TR-N31 | A-05 search finds by part of the name in any case or by part of the number, treats % as text, and the Activo and Retirado filters keep one on | Finds by name or number; `%` is plain text with the no-match text; `Retirado` adds withdrawn; one filter always stays on; count equals active athletes | pass | pending |
| TR-N32 | two Administrators saving overlapping terms at once: one is saved, the other is refused as an overlap | One 201, one 422 `term_overlap` (REQ-F-21) | pass | pending |
| TR-N33 | A-05 and S-05 with no athletes say so, and a filter that hides every athlete says Sin resultados | `Aún no hay atletas` with add; S-05 `Sin registros` + `Solo lectura`; hidden-by-filter shows `Sin resultados` (screen-map lines 309, 319) | pass | pending |
| TR-N34 | the roster is for signed-in staff: a signed-out call gets 401 on the list and the download | 401 | pass | pending |
| TR-N35 | withdrawing revokes every authorization of the athlete in the current and later terms with the reason removed from roster, and reinstating brings them all back | Both authorizations `revoked` with reason `removed from roster`, the audit entry lists both; a second withdrawal is 409 `roster_status_changed`; reinstate returns both to `active` (REQ-F-49, admin-flows 11 R3, R10). Past terms are not covered by the docs | pass | pending |
| TR-N36 | an athlete withdrawn by someone else while the list is open: Retirar answers that the athlete changed, and the list refreshes | The dialog says `Este atleta cambió mientras lo veías. Actualiza la lista.`; the list refreshes and the athlete leaves it; one audit entry (REQ-F-49) | pass | pending |

TR-N24: the zero-athlete case was not run.

### 9b. Terms and roster changes reaching the phone

| Path | Test | Expected result | Run | Manual |
|---|---|---|---|---|
| TR-X01 | (android) withdrawing a signed-in athlete on A-05 ends the access on the phone at its next refresh, and Check In is refused | Caption `Acceso vigente` becomes `Sin autorización activa` at the next refresh; Check In shows the athlete refusal (REQ-F-49, admin-flows 11 R3-R6). Replaces TR-N17 | pass | pending |
| TR-X01 | (iphone) withdrawing a signed-in athlete on A-05 ends the access on the phone at its next refresh, and Check In is refused | Caption `Acceso vigente` becomes `Sin autorización activa` at the next refresh; Check In shows the athlete refusal (REQ-F-49, admin-flows 11 R3-R6). Replaces TR-N17 | pass | pending |
| TR-X02 | (android) reinstating a withdrawn athlete on A-05 gives the phone its access back and Check In works | Access back; Check In gives the Gym ID; audit has `roster.withdraw` then `roster.reinstate` (admin-flows 11 R9-R11). Replaces TR-N21 | pass | pending |
| TR-X02 | (iphone) reinstating a withdrawn athlete on A-05 gives the phone its access back and Check In works | Access back; Check In gives the Gym ID; audit has `roster.withdraw` then `roster.reinstate` (admin-flows 11 R9-R11). Replaces TR-N21 | pass | pending |
| TR-X03 | (android) an athlete withdrawn during a visit keeps the open visit and the occupancy until it ends, leaves S-05, and then Check In is refused | Visit stays open and counts in occupancy; athlete leaves S-05; after the check-out the next Check In is refused (REQ-F-49, admin-flows 11 R5). Replaces TR-N18 | pass | pending |
| TR-X04 | (iphone) a record withdrawn on A-05 is not on the roster for the phone lookup, and it is found again once reinstated | Withdrawn: `Revisa tu número` with the not-on-roster text; reinstated: `Revisa tu correo` (admin-flows 11 R1, gap 15) | pass | pending |
| TR-X05 | (android) an athlete added on A-05 is found by the phone lookup, which refused the number before | First `Revisa tu número`, then `Revisa tu correo` (REQ-F-49, REQ-F-51) | pass | pending |
| TR-X06 | (android) a registration link sent before the record is withdrawn stops working on the phone | Link works, then `Este enlace ya no es válido` (admin-flows gap 15, line 617) | pass | pending |
| TR-X07 | (android) changing the institutional email of a record on A-05 cancels the unused registration link sent to the old email | `Este enlace ya no es válido`. The expected result comes from the code comment of #157, not from the docs (candidate doc gap) | pass | pending |
| TR-X08 | (android) ending the current term on A-04 stops a member's access on the phone, and moving the end back gives it again | Notice and `Sin término activo` on the dashboard, audit with dates before and after; phone `Sin autorización activa` and member refusal; after the end is restored access and Check In return (REQ-F-22, E-88) | pass | pending |
| TR-X08 | (iphone) ending the current term on A-04 stops a member's access on the phone, and moving the end back gives it again | Notice and `Sin término activo` on the dashboard, audit with dates before and after; phone `Sin autorización activa` and member refusal; after the end is restored access and Check In return (REQ-F-22, E-88) | pass | pending |
| TR-X09 | (android) a term added on A-04 to cover today after a gap becomes the active term on A-15, and only a member with an authorization in it can Check In | New term is the active chip on A-04 and A-15; the old-term member is refused; the new-term member checks in (REQ-F-21, REQ-F-22, admin-flows 9 N1-N2) | pass | pending |
| TR-X10 | Staff on S-05 see an athlete the Administrator withdraws leave the list, and see the entry of an athlete who checks in on the phone | `Check in` link opens S-03 with the number; after Check In `Entrada registrada` and the time; after check-out `Check in` again; after withdrawal the athlete is gone from S-05 (screen-map line 309, admin-flows 11 R1) | pass | pending |
| TR-X11 | (android) the term and roster changes of an Administrator are the ones the phone reads: a withdrawal done by the database stand-in and by A-05 leave the same state | Both end in the same phone state, revoked and removed (keeps TR-15 honest) | pass | pending |

## 10. Staff sessions and find person

Tests: `staff-sessions.spec.ts` (SS) and `cross-device-sessions.spec.ts` (SS-X). Screens S-01 (Sesiones activas), S-02 (session detail) and S-03 (find person, assisted Check In). Every row runs on the desktop project; the SS-X rows open a second context with the Pixel 7 profile for the phone. Bugs found by these paths: kim-014 (RG-02, S-03 confirm before the photo loaded, fixed in `7b3dff1`, issue #26). Not built, so no test: approving a new photo on S-02, the phone photo upload (U-02), and the read-only roster check from S-03.

### 10a. S-01 Sesiones activas

| Path | Test | Expected result | Run | Manual |
|---|---|---|---|---|
| SS-01 | Staff lands on S-01 with the chip, the occupancy card, the search and the table | h1 "Sesiones activas", chip "Gimnasio abierto", card "Personas dentro ahora" with a number, closing rule text, search, table columns Persona / Check In / Tiempo dentro / Autorización / Acción, menu Staff section only (no Administración) | pass | pending |
| SS-02 | an Administrator lands on the same S-01 with the Administrator items in the menu | same S-01; header "Administradora de prueba · Administrador"; menu shows Administración and "Cuentas del staff" | pass | pending |
| SS-03 | signed out: every sessions and people route answers 401 and the screens show the sign-in | 401 on every route; every screen shows the sign-in | pass | pending |
| SS-04 | a User (phone) account is refused on every staff sessions and people route | 401 | pass | pending |
| SS-05 | the row of a paid student shows name, Check In time, time inside, chip and the Marcar salida button | row: name link to /staff/sesiones/{id}, Check In time, "0 min", chip "Socio estudiante", button "Marcar salida"; hint "Selecciona una persona..." | pass | pending |
| SS-06 | the row of an athlete carries the chip "Atleta" | chip "Atleta" | pass | pending |
| SS-07 | the row of an employee member carries the chip "Socio empleado" | chip "Socio empleado" | pass | pending |
| SS-08 | the row of a manual access carries the chip "Acceso manual" | chip "Acceso manual" | pass | pending |
| SS-09 | boundary: a visit that began 5 minutes ago shows "5 min" inside | "5 min" | pass | pending |
| SS-10 | boundary: a visit that began 59 minutes ago shows "59 min" inside | "59 min" | pass | pending |
| SS-11 | boundary: a visit that began 60 minutes ago shows "1 h 0 min" inside | "1 h 0 min" | pass | pending |
| SS-12 | boundary: a visit that began 119 minutes ago shows "1 h 59 min" inside | "1 h 59 min", never time left | pass | pending |
| SS-13 | one visit: the list says "1 sesión activa" and the card counts 1 | list title "1 sesión activa", card 1 | pass | pending |
| SS-14 | two visits: the list says "2 sesiones activas" and the card counts 2 | "2 sesiones activas", card 2 | pass | pending |
| SS-15 | empty gym: "Sin sesiones activas", 0 sesiones, count 0 "Baja" and an empty bar | "Sin sesiones activas" + text, "0 sesiones activas", card 0 "Baja", empty bar | pass | pending |
| SS-16 | boundary: 13 people inside show "Baja" on the card and in the list title | count 13, "Baja", bar 13/40 | pass | pending |
| SS-17 | boundary: 14 people inside show "Moderada" on the card and in the list title | "Moderada" | pass | pending |
| SS-18 | boundary: 26 people inside show "Moderada" on the card and in the list title | "Moderada" | pass | pending |
| SS-19 | boundary: 27 people inside show "Alta" on the card and in the list title | "Alta" | pass | pending |
| SS-20 | boundary: 40 people inside show "Alta" on the card and in the list title | "Alta", bar full | pass | pending |
| SS-21 | boundary: 41 people inside show "Alta" on the card and in the list title | "Alta", bar capped at full, count 41 | pass | pending |
| SS-22 | search by part of a name, any letter case, shows only the matches | only Zurita and "1 sesión activa"; then both | pass | pending |
| SS-23 | search with no match: "Sin coincidencias" with the text, and "Limpiar búsqueda" brings the list back | "Sin coincidencias", text with the quoted search; the button empties the box, focuses it, list returns | pass | pending |
| SS-24 | boundary: a search of only spaces does not filter | list unchanged, no "Sin coincidencias" | pass | pending |
| SS-25 | search characters % and _ are literal, not wildcards | no match each time (literal characters) | pass | pending |
| SS-26 | S-01 searches by name only: an athlete student number finds nothing | "Sin coincidencias" (S-01 searches by name) | pass | pending |
| SS-27 | boundary: a search of 255 characters is accepted and 256 is refused (422) | 200 and 422 | pass | pending |
| SS-28 | ended visits never show: checked out, ended early, void and past the 2 hours | only the active one | pass | pending |
| SS-29 | a Check In made after the list opened appears at the next poll, and the count goes up, with no reload | new row appears and count 3 with no reload | pass | pending |
| SS-30 | a visit ended at another desk leaves the list at the next poll | row leaves | pass | pending |
| SS-31 | no connection: the number is hidden with "Datos no actuales", and Marcar salida is disabled | "Sin conexión", chip "Datos no actuales", text "Sin internet no podemos actualizar la ocupación.", number hidden, button aria-disabled and no dialog; number returns online | pass | pending |
| SS-32 | the list fails to load: "No actualizado" with Reintentar, which loads it | "No actualizado" + text; retry loads the list | pass | pending |
| SS-33 | while the list loads it says "Cargando sesiones" | "Cargando sesiones" + text, then the list | pass | pending |
| SS-34 | Marcar salida asks first; Cancelar closes the question and the visit stays open | dialog "Confirmar salida", "¿Marcar la salida de X?", "La sesión terminará con la hora actual de salida."; after Cancelar row stays, visit active | pass | pending |
| SS-35 | confirming Marcar salida says so, removes the row, and records the visit as checked out by this Staff account | message "Se marcó la salida de X.", row gone, focus on the list title, row checked_out with the Staff account id | pass | pending |
| SS-36 | an Administrator can check a person out from S-01 | check-out works | pass | pending |
| SS-37 | state transition: the visit already ended elsewhere when the question is confirmed; the list refreshes and no exit is claimed | list refreshes (row gone), no "Se marcó la salida" claimed, visit stays checked_out | pass | pending |
| SS-38 | after a check-out the occupancy card asks again at once, without waiting for the poll | card says 3 within 8 s (no 25 s wait), title "3 sesiones activas" | pass | pending |
| SS-39 | a check-out leaves the other people inside untouched | other row stays, visit active | pass | pending |

### 10b. S-02 session detail

| Path | Test | Expected result | Run | Manual |
|---|---|---|---|---|
| SS-40 | S-02 of a paid student: identity, authorization, term, waiver, emergency contact, the visit and its actions | URL /staff/sesiones/{id}; h1 "Persona y sesión"; name, "Socio estudiante", "Autorización activa", "Término: Término actual", waiver date and version, "Contacto de emergencia" with phone, "Sesión actual" chip "Activa", "Tiempo dentro", 3 buttons, photo question + "Marcar foto pendiente", ID photo | pass | pending |
| SS-41 | S-02 of an athlete shows the student number in full, the sport and the athlete chip | "Núm. estudiante: N" in full (9 digits), "Atleta", "Voleibol · Autorización activa" | pass | pending |
| SS-42 | Staff see only what REQ-NF-19 allows: the API sends no email, no phone of the person and no PIN | no email in either answer, person keys limited to name, number, type, sport, authorization, waiver, emergency contact, photo flags, active session; masked email only in the search | pass | pending |
| SS-43 | Marcar salida on S-02: the question names the person and the number, and the page shows the visit as registered | dialog with question, student number and text; message "Se marcó la salida."; focus on "Sesión registrada"; chip "Salida marcada"; "Salida" fact; buttons gone | pass | pending |
| SS-44 | Terminar antes: the visit ends now, is kept, and the audit log gets an entry | "La sesión terminó antes.", chip "Terminada antes", status ended_early, one audit entry | pass | pending |
| SS-45 | Anular: the visit stops counting, is kept as void, and the audit log gets an entry | "La sesión se anuló.", chip "Anulada", status void, audit entry, count back to 2 | pass | pending |
| SS-46 | Cancelar on each of the three S-02 questions leaves the visit active | visit stays active | pass | pending |
| SS-47 | an ended visit opened by its address shows "Sesión registrada", its exit and no session actions | "Sesión registrada", chip "Salida marcada", "Salida" time, no action buttons | pass | pending |
| SS-48 | a visit that does not exist: "No se pudo cargar la información" with Reintentar and Volver a sesiones | "No se pudo cargar la información", Reintentar, "Volver a sesiones" goes to S-01 | pass | pending |
| SS-49 | state transition: the visit ends at another desk while S-02 is open; the action is not applied and "La sesión cambió" shows | "La sesión cambió" + texts, nothing applied, "Actualizar datos" shows "Salida marcada" | pass | pending |
| SS-50 | Marcar foto pendiente on S-02: confirmation, the mark shows, the open visit stays open, the audit log gets an entry | dialog texts, "La foto quedó marcada como pendiente.", section "Foto pendiente", button gone, photo_pending_at set, visit active, audit entry | pass | pending |
| SS-51 | a person whose authorization was revoked while inside: "Sin autorización vigente" and no photo question | "Sin autorización vigente", no photo question, check-out still offered | pass | pending |
| SS-52 | the ID photo comes from the backend for an open visit (never cached) and is gone once the visit ended | 200 image, Cache-Control no-store, img shown; after the check-out 404 and initials, no img | pass | pending |
| SS-53 | a person without a term photo shows initials, not a broken image | initials "PS", no img | pass | pending |
| SS-54 | Back from S-02 returns to S-01 with the list | returns to S-01 with the row | pass | pending |
| SS-55 | an Administrator can check out, end early and void from S-02 | both applied | pass | pending |
| SS-56 | S-02 without a connection: the actions are disabled and the page says when the data was updated | "Sin conexión. Datos actualizados a las ...", the four buttons aria-disabled, no dialog | pass | pending |

### 10c. S-03 find person and assisted Check In

| Path | Test | Expected result | Run | Manual |
|---|---|---|---|---|
| SS-60 | the menu opens S-03 with the start state | /staff/buscar, h1, "Busca a la persona" + text, box, "Buscar", "Ver roster" to /staff/roster | pass | pending |
| SS-61 | search by full name finds one paid member: the card, no session, and the two verification buttons | focus on "Verifica la identidad", card, "Sin sesión activa...", photo, two buttons | pass | pending |
| SS-62 | search by the 9-digit student number finds the athlete and shows the number in full | athlete card with "Núm. estudiante: N" | pass | pending |
| SS-63 | boundary: 8 and 10 digits are not a student number and find nothing | "No encontramos coincidencias" both | pass | pending |
| SS-64 | a 9-digit number of a roster record nobody claimed finds nothing (no account to enter with) | no match | pass | pending |
| SS-65 | no match: the message, "Volver a buscar" empties the box, and "Ver roster" opens S-05 | "No encontramos coincidencias" + text; box emptied and focused; link opens /staff/roster | pass | pending |
| SS-66 | an empty or all-space search does nothing | no request, still the start state | pass | pending |
| SS-67 | several people with the name: "Selecciona a la persona" with masked emails, and the choice opens that person | "Selecciona a la persona" + text, 2 items with masked email, the choice opens B | pass | pending |
| SS-68 | boundary: 11 people match, the list shows the first 10 | 10 items | pass | pending |
| SS-69 | an athlete can also be found by name, in any letter case | found | pass | pending |
| SS-70 | assisted Check In of a paid member: confirm, back on S-01 with the welcome and the highlighted row, logged as an exception | dialog "Confirmar Check in" + text; back on /staff; "Check in registrado" + "X ya aparece en sesiones activas."; row highlighted; visit active and assisted; one audit entry; reload: no welcome | pass | pending |
| SS-71 | assisted Check In of an athlete found by student number | row chip "Atleta", assisted visit | pass | pending |
| SS-72 | Cancelar on the Check In question registers nothing | no visit, still "Verifica la identidad" | pass | pending |
| SS-73 | "La foto no coincide": the question, then the mark; no entry, the refusal shows and the confirm button is off | dialog texts; "Foto pendiente de actualizar"; "Confirmar Check in" disabled; photo_pending_at set; no visit | pass | pending |
| SS-74 | a past term only: "Sin autorización vigente", no entry and a way back to the search | "Sin autorización vigente" + text, no continue button, Volver a buscar, no visit | pass | pending |
| SS-75 | a term that has not started: "Sin autorización vigente", no entry and a way back to the search | same | pass | pending |
| SS-76 | a revoked authorization: "Sin autorización vigente", no entry and a way back to the search | same | pass | pending |
| SS-77 | no authorization at all: "Sin autorización vigente", no entry and a way back to the search | same | pass | pending |
| SS-78 | no term photo: "Falta la foto del término" with the confirm button off | "Falta la foto del término" + text, confirm disabled | pass | pending |
| SS-79 | photo already pending: "Foto pendiente de actualizar" with the confirm button off | "Foto pendiente de actualizar" + text, confirm disabled | pass | pending |
| SS-80 | a person already inside: "Ya tiene una sesión activa" with the time, a link to S-02, and no second visit | "Ya tiene una sesión activa" + text with the time, no continue button, link "Volver a sesiones" to /staff, "Ver sesión" opens S-02; one visit | pass | pending |
| SS-81 | the connection fails when the entry is confirmed: "No pudimos confirmar la entrada", and Actualizar datos checks again | "No pudimos confirmar la entrada" + text; refresh returns "Verifica la identidad"; no visit | pass | pending |
| SS-82 | a double click on the confirm button makes one visit | exactly one visit | pass | pending |
| SS-83 | no connection on S-03: searching says "Sin conexión" and the confirm button is off | "Sin conexión" + text; "Confirmar Check in" aria-disabled | pass | pending |
| SS-84 | coming from S-05 with ?numero=: the box is filled and the search runs once | box filled, one search request, the athlete shown | pass | pending |
| SS-85 | the search itself fails: "No pudimos buscar a la persona" with Reintentar | "No pudimos buscar a la persona" + text; retry finds the person | pass | pending |
| SS-86 | an Administrator can run the assisted Check In | works, assisted visit | pass | pending |
| SS-87 | the assisted Check In API refuses a missing or unknown person (422, 404) and a photo mark on a person with no authorization (409) | 422, 422, 404, check_in_no_authorization, 409, 422 | pass | pending |
| SS-88 | after a check-out the same person can be checked in again: a second visit, the first kept | second visit active and assisted, first kept | pass | pending |
| SS-89 | a visit that ran past its 2 hours is not "inside": the person can be checked in at the desk | "Verifica la identidad" (not inside), new visit | pass | pending |
| SS-90 | the welcome address is read once: a foreign ?registrado= shows no welcome and the address is cleaned | no welcome, address cleaned | pass | pending |
| SS-91 | gym closed by a closure: the chip says it, the desk Check In is refused with "Gimnasio cerrado" and nothing is recorded | "Gimnasio cerrado" + text, no visit; chip "Gimnasio cerrado" | pass | pending |
| SS-92 | athletes-only period: a paid member is refused at the desk, an athlete is accepted, and the chip says it | paid: "Horario exclusivo para atletas" + text, no visit; athlete: row; chip "Horario exclusivo para atletas" | pass | pending |

### 10d. Desk and phone together

| Path | Test | Expected result | Run | Manual |
|---|---|---|---|---|
| SS-X-01 | a Check In on the phone appears in S-01 at the next poll, and the count goes up on the desk and on the phone | row appears with "Socio estudiante", desk 4, phone 4 | pass | pending |
| SS-X-02 | the same number on the phone (Gimnasio) and on the desk (S-01) with the same level and bar | 15 on both, "Moderada" on both, "15 sesiones activas" | pass | pending |
| SS-X-03 | a check-out from the S-01 list ends the visit on the phone and drops both counts | desk 2; phone "Tu visita ha terminado", "Tu salida fue registrada por el personal.", no "Sesión activa"; phone count 2 | pass | pending |
| SS-X-04 | a check-out from S-02 ends the visit on the phone | phone ended view with reason and "Duración total" | pass | pending |
| SS-X-05 | "Terminar antes" on S-02 reaches the phone as the same ended view (Staff ending early means a check-out for the person) | phone ended view, same reason | pass | pending |
| SS-X-06 | "Anular" on S-02 takes the visit off the phone: no ended view for a voided visit, the ready screen returns, the count drops | phone back to the ready screen (a voided visit is never shown), phone count 2 | pass | pending |
| SS-X-07 | an assisted Check In on S-03 shows the open visit on the phone of that member, with the entry time of S-01 | phone shows "¡Tu entrada quedó registrada!" and "Sesión activa" at its poll; entry time equals the S-01 row; visit assisted | pass | pending |
| SS-X-08 | an assisted Check In of an athlete shows the athlete Gym ID on the phone | phone athlete Gym ID, category "Atleta"; S-01 chip "Atleta" | pass | pending |
| SS-X-09 | a photo marked pending at the desk (S-03) blocks the person own Check In on the phone, with the pending-photo message | phone "Tu foto necesita actualizarse" + text; no visit | pass | pending |
| SS-X-10 | after the phone Check In, S-03 finds the person already inside and offers the visit instead of a second entry | "Ya tiene una sesión activa"; "Ver sesión" opens S-02 "Activa"; one visit | pass | pending |
| SS-X-11 | after an assisted Check In the phone own Check In opens the same visit and makes no second one | Gym ID of the same visit, answer 200, one visit, desk count 2 | pass | pending |
| SS-X-12 | two desks do the assisted Check In of the same person at once: one visit, the other desk is told the person is already inside | one 201, one 409 check_in_session_active naming the visit; one visit; one audit entry | pass | pending |
| SS-X-13 | state transition: after the desk check-out the phone can check in again and the new visit is a new S-01 row | new S-01 row; visits checked_out then active, second not assisted | pass | pending |

## 11. Regressions of 2026-11-10

Test: `regressions-1110.spec.ts`. One test per bug found on 2026-11-10 after the path run. Bugs: kim-014 ([issue #26 comment](https://github.com/Th3-Minorities/natatorio-gym-app/issues/26#issuecomment-6761273391), fixed in `7b3dff1`) and kim-015 ([issue #17 comment](https://github.com/Th3-Minorities/natatorio-gym-app/issues/17#issuecomment-6761675254), fixed in `79775d1`).

| Path | Test | Project | Expected result | Run | Manual |
|---|---|---|---|---|---|
| RG-01 | assisted Check In announces its confirmation after navigating to S-01 | desktop | After the assisted Check In the page is S-01 with the new row, and the confirmation title is announced in a status or live region. | pass | pending |
| RG-02 | S-03 explains that the identification photo is still loading | desktop | While the photo request is held, S-03 shows the photo loading title and text instead of a search error. | pass (bug kim-014, fixed in `7b3dff1`) | pending |
| RG-03 | focused controls stay above the bottom navigation on a short phone | android, iphone | On a 320 by 568 phone, the focused Continuar button (end of visit), Privacidad link and Ajustes link sit above the top of the bottom navigation. | pass | pending |
| RG-04 | a User without a current authorization sees the no-access state before any press, with no Check In button | android, iphone | A paid member whose term ended and a revoked athlete see the no-access panel (title and action) before any press, and no Check In hold button exists. | pass (bug kim-015, fixed in `79775d1`) | pending |
