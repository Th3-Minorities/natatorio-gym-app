# Flow test results

Results of issue #152: every flow in the midterm scope, from its first screen to its last. Each flow has one automated browser test in `frontend/e2e/flows/`, which runs in CI with the other browser tests on the seeded test data. The Manual column is for the run on real phones: an iPhone with Safari and an Android phone with Chrome, or a desktop browser for the Staff and Administrator flows.

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
| Unclaimed Authorization Numbers | `PRUEBA1` (Chromium), `PRUEBA2` (Edge) |
| Claimed Authorization Number | `USADO01` |
| Authorization Number of a term that ended | `VENCIDO` |
| Member with a current paid authorization | `pago-activo@example.com` |
| Member whose paid term ended | `pago-vencido@example.com` |
| User for sign-in | `user@example.com`, password `test-user-password-129` |
| User for the forgotten password | `sin-autorizacion@example.com` (the test sets a new password each run) |
| Administrator and Staff | `admin@example.com`, `staff@example.com` |
| Gym location | latitude 18.2110, longitude -67.1410 |

The seeded hours are Monday to Friday, 6:00 to 22:00, Puerto Rico time. Outside them every Check In gets "El gimnasio está cerrado", so the Check In, Gym ID and end of visit tests check that answer and skip the steps after it. A CI run at night or on a weekend skips those steps.

Result words: pass, fail, skipped (with the reason in the row), not built (the screen is not on `main` yet), pending (not run yet).

The CI column holds the first local run, on 2026-11-09, in Chromium and Edge, on a fresh seed, the same way CI runs them. It ran at 2:00 Puerto Rico time, when the seeded hours keep the gym closed, so those steps skipped. "pass, open hours" means the step passed in a second run with one special-hours row added to the local database around that time.

## 1. Paid member registration

Test: `paid-registration.spec.ts`

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Open Welcome and tap Comenzar | none | "Antes de comenzar" with the privacy notice | pass | pending |
| 2 | Tap Continuar con el registro | none | Number entry screen, "Registro" | pass | pending |
| 3 | Enter a 9-digit number | `802123456` | Field marked invalid with the student hint, no lookup | pass | pending |
| 4 | Enter an expired number | `VENCIDO` | "Necesitas una membresía pagada. ¿Problemas? Llama al 265-3866." | pass | pending |
| 5 | Enter an already used number | `USADO01` | Same message as step 4 | pass | pending |
| 6 | Enter a valid number | `PRUEBA1` or `PRUEBA2` | "¡Hola, [name]!" and "Crea una contraseña" | pass | pending |
| 7 | Enter and confirm a password | 10 or more characters | Photo step, Continuar disabled until a photo is chosen | pass | pending |
| 8 | Take a photo | a PNG through the camera input | Photo preview | pass | pending |
| 9 | Upload a photo instead | a PNG through Subir foto | Photo preview with the new photo, Continuar enabled | pass | pending |
| 10 | Tap Crear cuenta with nothing filled | none | Errors on the waiver box, contact name and phone | pass | pending |
| 11 | Open Leer relevo completo and go back | none | "Relevo" with the draft text, then back to the form | pass | pending |
| 12 | Accept the waiver, fill the emergency contact | `Contacto de Prueba`, `787-555-0100` | Form ready | pass | pending |
| 13 | Tap Crear cuenta while the save fails | API answer replaced once with a server error | "No pudimos crear tu cuenta", then Volver a mi foto keeps the photo, waiver and contact | pass | pending |
| 14 | Tap Crear cuenta again | none | Install help, "Instala la app" | pass | pending |
| 15 | Choose iPhone and tap Continuar | none | Check In, "Miembro" with the active authorization badge | pass | pending |

## 2. Athlete registration

Test: `athlete-registration.spec.ts`, skipped.

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Student number on the roster, not on the roster, already claimed, wrong length; email link opened, expired, used | none | Not built: `main` has no student number lookup or athlete email link | not built | not built |

## 3. User sign in

Test: `user-sign-in.spec.ts`

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Sign in with a wrong password | `user@example.com` | "No pudimos iniciar sesión", still on Sign in | pass | pending |
| 2 | Sign in with the right password | `user@example.com` | Mi cuenta | pass | pending |
| 3 | Tap Check-in in the navigation | none | Check In with the hold button | pass | pending |
| 4 | Sign in on a second phone, reload the first | same account | First phone: Sign in with "Iniciaste sesión en otro dispositivo" | pass | pending |
| 5 | Tap ¿Olvidaste tu contraseña? and send the link | `sin-autorizacion@example.com` | "Solicitud recibida" | pass | pending |
| 6 | Open the email link and save a new password | a new long password | Back to Sign in | pass | pending |
| 7 | Sign in with the new password | same account | Mi cuenta, "Sin autorización activa" | pass | pending |

## 4. Check In

Test: `check-in.spec.ts`

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Hold Check In with no current authorization | `pago-vencido@example.com`, inside the gym | "Tu acceso no está vigente", Revisar mi acceso goes to Mi cuenta | pass | pending |
| 2 | Hold Check In with location denied | `pago-activo@example.com` | "Activa el permiso de ubicación", the help opens and closes | pass | pending |
| 3 | Tap Reintentar with poor accuracy | 500 m accuracy | "Necesitamos mayor precisión" | pass, open hours | pending |
| 4 | Tap Intentar de nuevo outside the gym | about 1 km away | "Acércate al gimnasio" | pass, open hours | pending |
| 5 | Tap Intentar de nuevo inside the gym | gym location | "¡Tu entrada quedó registrada!", Gym ID with "Sesión activa" and "Estudiante" | pass, open hours | pending |
| 6 | Check In again | same account | Same visit, same entry time | pass, open hours | pending |
| 7 | Hold Check In as a member in an athletes-only period | Saturday 8:00 to 12:00 | "Ahora entrenan los atletas" | skipped: needs the server clock in that period | pending |

## 5. Gym ID and occupancy

Test: `gym-id-occupancy.spec.ts`

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Open Gimnasio | `pago-activo@example.com` | Count, level (Baja, Moderada, Alta by thirds of 40) and update time | pass | pending |
| 2 | Check In from inside the gym | gym location | Gym ID: "Sesión activa", "Entrada registrada", "Duración" | pass, open hours | pending |
| 3 | Lose the connection | offline | "No válida ahora" and "Restablece la conexión para validar tu tarjeta." | pass, open hours | pending |
| 4 | Get the connection back | online | "Sesión activa" again | pass, open hours | pending |
| 5 | Open Gimnasio | none | Count one higher than step 1 | pass, open hours | pending |
| 6 | Front desk check-out, reload Gimnasio | the Staff API (the desk screen is not built) | Count back to step 1 | pass, open hours | pending |

## 6. End of a visit

Test: `end-of-visit.spec.ts`

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Check In from inside the gym | `pago-activo@example.com` | Gym ID, "Sesión activa" | pass, open hours | pending |
| 2 | Front desk check-out | the Staff API (the desk screen is not built) | Visit ended | pass, open hours | pending |
| 3 | Reload the phone | none | "Tu visita ha terminado", "Sesión finalizada", entry, exit, total duration, "Tu salida fue registrada por el personal." | pass, open hours | pending |
| 4 | Tap Continuar | none | Check In ready for the next visit | pass, open hours | pending |
| 5 | Wait 2 hours after a Check In | none | "La sesión se cerró automáticamente." | skipped: needs the server clock 2 hours ahead | pending |
| 6 | Reach the end of the term during a visit | none | The visit ends | skipped: needs the server clock at the term end | pending |

## 7. App base

Test: `app-base.spec.ts`

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Open the install help | none | "Instala la app", Android steps on a non-iPhone | pass | pending |
| 2 | Choose iPhone | none | Safari steps, Continuar goes to Mi cuenta | pass | pending |
| 3 | Read the manifest | none | "Gimnasio RUM", standalone, starts at Mi cuenta | pass | pending |
| 4 | Open the install help in the installed app | iOS standalone flag | "¡Todo listo!" | pass | pending |
| 5 | Install on iPhone and Android | real phones | App icon on the home screen, opens full screen | not automated | pending |
| 6 | Open the app with no connection | offline | Welcome and the install help open | pass | pending |

## 8. Staff accounts

Test: `staff-accounts.spec.ts`

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

| Step | Action | Test data | Expected result | CI | Manual |
|---|---|---|---|---|---|
| 1 | Add a term, an overlapping term, athletes, a repeated student number; withdraw, reinstate; download Word and PDF | none | Not built: `main` has no Terms or roster screen | not built | not built |
