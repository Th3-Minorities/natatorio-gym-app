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
| Student number of a claimed roster record | `802000002` |
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
| 2 | Enter a student number already claimed | `802000002` | "Revisa tu registro", "Este registro no está disponible para crear otra cuenta.", Iniciar sesión and Cambiar número | skipped: lookup limit, run by the path tests | pending |
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

Test: `terms-roster.spec.ts`, skipped.

CI: [run 42705124653](https://github.com/Th3-Minorities/natatorio-gym-app/actions/runs/42705124653), Chrome, Edge, Firefox and Safari browser jobs: the test is skipped because `main` has no Terms or roster screen, so every step is not built. Paths: [flow-paths.md](flow-paths.md#9-terms-and-athlete-roster). No bug found by the path tests.

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Add a term, an overlapping term, athletes, a repeated student number; withdraw, reinstate; download Word and PDF | none | Not built: `main` has no Terms or roster screen | not built | not built |
