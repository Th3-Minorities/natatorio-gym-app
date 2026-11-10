# Flow path results

Every path of every flow in the midterm scope, run on 2026-11-09 on branch `152-flow-e2e-tests` for issue #152. The step tables of each flow are in [flow-results.md](flow-results.md). Each path here has its own browser test, written with a test technique (equivalence partitions, boundary values, state transitions, error guessing, permissions). Rows that the final run flagged were rerun after their fix (see the Bug column). The four Safari rows of Staff accounts were rerun on Desktop, Firefox and Safari after the bug 14 fix.

Devices: Android is a Pixel 7 and iPhone is an iPhone 13, both emulated in Playwright (Chromium and WebKit). Desktop (Chrome), Firefox and Safari (WebKit) run the dashboard only, so the User app rows show n/a there. Real phones are the manual runs.

Result words:

- pass, fail: the path ran on that device.
- flaky: failed once and passed on the automatic retry.
- n/a: the path is not run on that device by design.
- not built: the screen the path needs is not on `main`.
- manual: needs a real phone.
- not run: needs something this run cannot do (a server clock, two builds); the Bug column says what.
- pending: not decided yet, under investigation.
- by hand: checked by a person because Playwright cannot do it on that browser.

A bug found by a path was fixed and the path rerun: the cell shows the result after the fix and the Bug column links the report and the fix commit. A path counts as passed when it passes on every device it runs on, and as not run when a device is manual, not run, pending or by hand.

## Totals

| Flow | Paths | Passed | Failed | Flaky | Not built | Not run |
|---|---|---|---|---|---|---|
| [1. Paid member registration](#1-paid-member-registration) | 70 | 67 | 0 | 0 | 1 | 2 |
| [2. Athlete registration](#2-athlete-registration) | 53 | 50 | 0 | 0 | 2 | 1 |
| [3. User sign in](#3-user-sign-in) | 55 | 52 | 0 | 1 | 1 | 1 |
| [4. Check In](#4-check-in) | 83 | 81 | 0 | 2 | 0 | 0 |
| [5. Gym ID and occupancy](#5-gym-id-and-occupancy) | 58 | 57 | 0 | 0 | 0 | 1 |
| [6. End of a visit](#6-end-of-a-visit) | 47 | 47 | 0 | 0 | 0 | 0 |
| [7. App base](#7-app-base) | 35 | 31 | 0 | 0 | 0 | 4 |
| [8. Staff accounts](#8-staff-accounts) | 95 | 94 | 0 | 0 | 0 | 1 |
| [9. Terms and athlete roster](#9-terms-and-athlete-roster) | 21 | 21 | 0 | 0 | 0 | 0 |
| Total | 517 | 500 | 0 | 3 | 4 | 10 |

## 1. Paid member registration

Devices that ran: Android, iPhone. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| PR-01 a paid member registers from Welcome and reaches Check In | Equivalence (valid), end to end | Ends at /check-in, heading "Check-in", "Miembro", img "Autorización activa" | pass | pass | n/a | n/a | n/a |  |
| PR-02 the Welcome sheet opens with a tap or a swipe of 30 px, not with a short drag | State transition (Welcome sheet) | Tap and swipe >=30 px open the sheet: "Bienvenido al gimnasio", "Comenzar" | pass | pass | n/a | n/a | n/a |  |
| PR-03 the sign in and Welcome entry points lead to registration and sign in | State transition (entry points) | /sign-in goes to /register privacy | pass | pass | n/a | n/a | n/a |  |
| PR-04 the privacy gate leads to the number step and shows the draft badge | State transition (privacy gate) | /register/identify, heading "Registro" | pass | pass | n/a | n/a | n/a |  |
| PR-05 the privacy notice that fails to load can be retried | Error guessing (privacy load fails) | "No pudimos mostrar el aviso" | pass | pass | n/a | n/a | n/a |  |
| PR-06 the privacy notice is available offline and reloads when the connection returns | Offline | "El aviso está disponible sin conexión." | pass | pass | n/a | n/a | n/a |  |
| PR-07 a direct URL to a later step shows the privacy notice | State transition (direct URL, invalid order) | Each shows the privacy notice ("Antes de comenzar"), no step content | pass | pass | n/a | n/a | n/a |  |
| PR-08 reloading any step loses the data and starts again at the privacy notice | State transition (refresh) | Privacy notice again | pass | pass | n/a | n/a | n/a |  |
| PR-09 browser Back and the header arrow walk the steps backwards and keep the data | State transition (browser Back / header arrow) | Photo, password, number steps in reverse | pass | pass | n/a | n/a | n/a |  |
| PR-10 the number ignores letter case and surrounding spaces | Equivalence (number, valid, case and spaces) | The number ignores letter case and surrounding spaces | pass | pass | n/a | n/a | n/a |  |
| PR-11 an order from an expired term gets the generic unavailable answer | Equivalence (expired term) | Field relabeled "Número de autorización" | pass | pass | n/a | n/a | n/a |  |
| PR-12 an order already used gets the same answer as an expired one | Equivalence (already used) | An order already used gets the same answer as an expired one | pass | pass | n/a | n/a | n/a |  |
| PR-13 an unknown number gets the same answer | Equivalence (unknown number) | An unknown number gets the same answer | pass | pass | n/a | n/a | n/a |  |
| PR-14 a cancelled order gets the same answer | Equivalence (cancelled order) | A cancelled order gets the same answer | pass | pass | n/a | n/a | n/a |  |
| PR-15 an order paid at the start of the term is valid, one second earlier is not | Boundary (paid_at vs term start, 2-value) | PR15A goes to password | pass | pass | n/a | n/a | n/a |  |
| PR-16 an order is valid until the last day of the term and not the day after | Boundary (term end, 2-value) | Today: reaches password | pass | pass | n/a | n/a | n/a |  |
| PR-17 an order of a term that has not started gets the generic answer | Equivalence (term not started) | An order of a term that has not started gets the generic answer | pass | pass | n/a | n/a | n/a |  |
| PR-18 a number of 20 characters is looked up, one of 21 is a validation error | Boundary (length 20 / 21, 2-value) | 20 characters: not-valid text; 21: validation error from the API | pass | pass | n/a | n/a | n/a |  |
| PR-19 eight and ten digit numbers are looked up as authorization numbers | Boundary (student number vs authorization, 2-value) | Eight and ten digit numbers are looked up as authorization numbers | pass | pass | n/a | n/a | n/a |  |
| PR-20 an empty field sends nothing and hostile input is shown as text | Error guessing (empty and hostile input) | Empty: no request (field has required, browser message) | pass | pass | n/a | n/a | n/a |  |
| PR-21 a number whose email already has an account asks to sign in and stays unclaimed | Equivalence (existing account, renewal) | Origin/main: "Ya tienes una cuenta", masked email p***a@example.com | pass | pass | n/a | n/a | n/a |  |
| PR-22 the store buttons show only when the store link is set | State transition (store link) | With: button "Comprar membresía" and "¿No tienes membresía?" link, target=_blank | pass | pass | n/a | n/a | n/a |  |
| PR-23 offline the number step disables Continuar and keeps the number | Offline (lookup) | Offline banner "Sin conexión" | pass | pass | n/a | n/a | n/a | [Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19487648), fixed in `1c12007` |
| PR-24 a server error on the lookup shows the generic message and keeps the number | Error guessing (5xx on lookup) | "Algo salió mal de nuestro lado. Intenta más tarde." field keeps the number | pass | pass | n/a | n/a | n/a |  |
| PR-25 the 11th failed lookup is rate limited with a wait time, and works again after the limiter resets | Rate limit boundary (10th / 11th failure) | 11th: 429, field error "Intenta de nuevo a las HH:MM." | pass | pass | n/a | n/a | n/a |  |
| PR-26 tapping Continuar twice sends one lookup | Error guessing (double tap) | One POST /lookup (pending guard), one navigation | pass | pass | n/a | n/a | n/a |  |
| PR-27 a signed-in visitor cannot open the registration | State transition (signed-in visitor) | Registration routes answer 403 forbidden | pass | pass | n/a | n/a | n/a |  |
| PR-28 a valid password moves on and the show buttons reveal both fields | Equivalence (password valid) and show/hide | "Contraseña" and "Confirmar contraseña" plain text when shown | pass | pass | n/a | n/a | n/a |  |
| PR-29 a password of 9 characters is refused, 10 is accepted | Boundary (password length 9 / 10, 2-value) | A password of 9 characters is refused, 10 is accepted | pass | pass | n/a | n/a | n/a |  |
| PR-30 a confirmation that differs is refused | Equivalence (confirmation mismatch) | "Las contraseñas deben coincidir." | pass | pass | n/a | n/a | n/a |  |
| PR-31 a password of 255 characters is accepted and the 256th is not typed | Boundary (password max 255 / 256, 2-value) | Field has maxLength=255 | pass | pass | n/a | n/a | n/a |  |
| PR-32 a password of 5 emoji (10 UTF-16 units) goes back to the password step with the server message | Exploratory (multi-byte length) | Client lets it through (password.length counts UTF-16) | pass | pass | n/a | n/a | n/a |  |
| PR-33 a compromised password goes back to the password step and the error clears on edit | Equivalence (compromised password) | Back to /register/password, error "Esta contraseña apareció en una filtración. Elige otra." | pass | pass | n/a | n/a | n/a |  |
| PR-34 a photo is taken or chosen on the camera input and shows a preview | Equivalence (photo, camera input) | Preview "Vista previa de la foto elegida" | pass | n/a | n/a | n/a | n/a |  |
| PR-35 an uploaded photo replaces the taken one and a cancelled picker keeps it | Equivalence (photo, upload replaces taken) | New preview replaces the old | pass | pass | n/a | n/a | n/a |  |
| PR-36 with the camera permission denied only Subir foto is offered | Permission state (camera denied) | Text "No tenemos permiso para usar tu cámara. Puedes subir una foto de tu dispositivo." | pass | pass | n/a | n/a | n/a |  |
| PR-37 without a camera only Subir foto is offered | Permission state (no camera) | "Este dispositivo o navegador no tiene una cámara disponible. Puedes subir una foto." | pass | pass | n/a | n/a | n/a |  |
| PR-38 "Tomar foto", take a selfie, accept | Permission state (camera granted, real) | Preview shows the selfie | manual | manual | n/a | n/a | n/a | real phone only |
| PR-39 JPEG and PNG photos are accepted | Equivalence (photo formats) | JPEG and PNG accepted | pass | pass | n/a | n/a | n/a |  |
| PR-40 a photo of exactly 10 MB is accepted, one byte more is refused before sending | Boundary (photo size 10 MB, 2-value) | A photo of exactly 10 MB is accepted, one byte more is refused before sending | pass | pass | n/a | n/a | n/a |  |
| PR-41 curl multipart | Boundary (server size, API) | 422 validation_failed, details.photo contains max | n/a | n/a | n/a | n/a | n/a | checked by a backend test |
| PR-42 a GIF, a PDF and a text file renamed .jpg are refused as a wrong format | Equivalence (photo wrong type) | Server mimetypes fails: heading "Revisa tu foto" | pass | pass | n/a | n/a | n/a |  |
| PR-43 an empty photo file is refused by the server | Boundary (photo 0 bytes) | Client accepts size 0 | pass | pass | n/a | n/a | n/a |  |
| PR-44 a corrupt image is refused and the number is still free for a good photo | Equivalence (corrupt image) | Alert "Tu foto no se pudo procesar" | pass | pass | n/a | n/a | n/a |  |
| PR-45 a large JPEG with EXIF is stored resized, light, upright and without EXIF | Equivalence (large valid photo, resize) | A large photo is accepted and stored resized | pass | pass | n/a | n/a | n/a |  |
| PR-46 Crear cuenta names each missing field and each error clears when its field is edited | Decision table (required fields) | Crear cuenta names each missing field and each error clears when its field is edited | pass | pass | n/a | n/a | n/a |  |
| PR-47 the full waiver opens, shows its text and version, and Volver keeps the form | Equivalence (full waiver) | /register/waiver, heading "Relevo" | pass | pass | n/a | n/a | n/a |  |
| PR-48 the contact name rejects spaces, stops at 255 characters and accepts accents | Equivalence (contact name) | Spaces only: "Escribe el nombre de tu contacto." | pass | pass | n/a | n/a | n/a |  |
| PR-49 a phone with 6 digits or no digits is refused by the server, 7 digits is accepted | Boundary (phone digits 6 / 7, 2-value) | 6 or no digits refused; 7 digits accepted | pass | pass | n/a | n/a | n/a |  |
| PR-50 four phone formats are accepted and letters are refused | Equivalence (phone formats) | Four phone formats are accepted and letters are refused | pass | pass | n/a | n/a | n/a |  |
| PR-51 a phone of 30 digits is accepted and the 31st is not typed | Boundary (phone length 30 / 31, 2-value) | A phone of 30 digits is accepted and the 31st is not typed | pass | pass | n/a | n/a | n/a |  |
| PR-52 a waiver that fails to load blocks the account and can be retried | Error guessing (waiver fails to load) | Crear cuenta disabled | pass | pass | n/a | n/a | n/a |  |
| PR-53 a stale waiver version reloads the waiver and the form can be sent again | Error guessing (waiver version stale) | Waiver reloads on the contact page, nothing created, user can resubmit | pass | pass | n/a | n/a | n/a |  |
| PR-54 a save error returns to the photo with the data kept and the second try succeeds | Error guessing (save error 500) | "Guardando tu cuenta" then "No pudimos crear tu cuenta" / "El registro no se completó" | pass | pass | n/a | n/a | n/a |  |
| PR-55 a connection that drops during the save shows the save error and the number stays free | Offline (connection drops during save) | Save-failed screen (same as PR-54) | pass | pass | n/a | n/a | n/a |  |
| PR-56 tapping Crear cuenta twice creates one account | Error guessing (double submit) | "Guardando tu cuenta", "Guardando…" disabled button | pass | pass | n/a | n/a | n/a |  |
| PR-57 when someone else claims the number first the second person goes back to the number step | State transition (claim race) | Context 1: back to number entry, text of PR-11, no second account | pass | pass | n/a | n/a | n/a |  |
| PR-58 an account created for the email meanwhile sends the person to the existing account screen | State transition (account created for the email meanwhile) | Existing-account screen on the number step | pass | pass | n/a | n/a | n/a |  |
| PR-59 a lost privacy acceptance returns to the privacy notice and creates nothing | State transition (privacy lost mid-flow) | A lost privacy acceptance returns to the privacy notice and creates nothing | pass | pass | n/a | n/a | n/a |  |
| PR-60 a rate limited save stays on the contact step with a wait time | Rate limit (429 on complete) | A rate limited save stays on the contact step with a wait time | pass | pass | n/a | n/a | n/a |  |
| PR-61 a retry after a lost save response ends at the install help with one account | State transition (repeat after success) | API answers 403 forbidden (already signed in) | pass | pass | n/a | n/a | n/a |  |
| PR-62 the install help on iPhone lists the Safari steps and Continuar goes to Check In | Equivalence (install help, iPhone tab) | The install help on iPhone lists the Safari steps and Continuar goes to Check In | n/a | pass | n/a | n/a | n/a |  |
| PR-63 the install help on Android lists the Chrome steps, offers the browser prompt and Ahora no goes to Check In | Equivalence (install help, Android tab) | "Ahora no" goes to /check-in | pass | n/a | n/a | n/a | n/a |  |
| PR-64 an already installed app says so and continues to Check In | State transition (already installed) | "¡Todo listo!", "Ya estás usando la app instalada.", button "Continuar" to /check-in | pass | pass | n/a | n/a | n/a |  |
| PR-65 Mi cuenta shows the name, email, Miembro badge and the current term | State transition (landing) | Name from the order, full email, badge "Miembro", "Acceso vigente · Término actual" | pass | pass | n/a | n/a | n/a |  |
| PR-66 signing in on a second device replaces the first one | Cross-device (phone to phone) | First device is signed out with the replaced-session notice | pass | pass | n/a | n/a | n/a |  |
| PR-67 Staff dashboard | Cross-device (phone to staff dashboard) | Not built: no staff screen lists members or sessions | not built | not built | not built | not built | not built | no staff screen lists members |
| PR-68 the whole registration runs in English when English is chosen on Welcome | Equivalence (language) | Whole flow in English including waiver text (config/registration.php en) | pass | pass | n/a | n/a | n/a |  |
| PR-69 the registration fits the phone screen at every step | Device (viewport, keyboard) | No horizontal scroll | pass | pass | n/a | n/a | n/a |  |
| PR-70 on a slow 3G network the save keeps showing Guardando until the answer arrives | Device (slow network) | "Guardando tu cuenta" stays until the answer | pass | n/a | n/a | n/a | n/a |  |

## 2. Athlete registration

Devices that ran: Android, iPhone. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| AR-01 an athlete on the roster registers from Welcome through the emailed link and reaches Check In | Equivalence (valid), end to end | Account created, Check In opens | pass | pass | n/a | n/a | n/a |  |
| AR-02 a student number on the roster shows Revisa tu correo with the masked email and the resend countdown | Equivalence (student number on roster, N03-09) | Heading "Revisa tu correo", "Enviamos un enlace a tu correo institucional." | pass | pass | n/a | n/a | n/a |  |
| AR-03 the email goes to the roster address with the subject, button, expiry text and a 64 character token | Content check (email) | Email to the roster address with the subject and button | pass | pass | n/a | n/a | n/a |  |
| AR-04 a number not on the roster asks the person to check it and sends no email | Equivalence (not on roster) | Heading "Revisa tu número" | pass | pass | n/a | n/a | n/a |  |
| AR-05 a number removed from the roster gets the same answer as one not on it | Equivalence (removed from roster) | Same answer as a number not on the roster | pass | pass | n/a | n/a | n/a |  |
| AR-06 a number already claimed points to sign in and sends no email | Equivalence (already claimed) | Heading "Revisa tu registro", "Este registro no está disponible para crear otra cuenta." | pass | pass | n/a | n/a | n/a |  |
| AR-07 8 and 10 digits are looked up as authorization numbers and 9 digits as a student number | Boundary (length 8 / 9 / 10, 2-value) | 8 and 10 digits: authorization number; 9: student number | pass | pass | n/a | n/a | n/a |  |
| AR-08 a letter or dashes make an authorization number, spaces are trimmed, all zeros is not on the roster | Equivalence (9 non-digit classes) | Letters and dashes use the authorization path; spaces are trimmed | pass | pass | n/a | n/a | n/a |  |
| AR-09 hostile input after a valid number is data: no script, no error, no email | Error guessing (hostile input) | Unavailable text, no script, no SQL error, no email | pass | pass | n/a | n/a | n/a |  |
| AR-10 a roster email that already has an account asks to sign in and sends no email | Equivalence (roster email already has an account) | N03-04 "Ya tienes una cuenta", masked email | pass | pass | n/a | n/a | n/a |  |
| AR-11 Corregir nÃºmero goes back to the field with the number kept and a paid number then works | State transition (Corregir número) | Back to the field with the number kept | pass | pass | n/a | n/a | n/a |  |
| AR-12 a second lookup is blocked before 300 s with the time to try again and sends another email after | Boundary (resend 299 s / 301 s, 2-value) | Before 300 s a wait notice; after it a new email | pass | pass | n/a | n/a | n/a |  |
| AR-13 the resend button waits for the countdown, sends a second email and the first link is replaced | State transition (resend button) | "Reenviar en 05:00" down to 00:00 then "Solicitar enlace" enabled | pass | pass | n/a | n/a | n/a |  |
| AR-14 five links a day are sent, the sixth waits until 24 h after the first, and another record is not affected | Boundary (daily limit 5 / 6, 2-value) | 6th: 429 with Retry-After until 24 h after the oldest link | pass | pass | n/a | n/a | n/a |  |
| AR-15 tapping Continuar twice sends one lookup and one email | Error guessing (double tap) | One POST, one email (pending guard + row lock) | pass | pass | n/a | n/a | n/a |  |
| AR-16 offline the number step shows the banner and keeps the number, and it works again online | Offline (lookup) | Banner "Sin conexión", "Conéctate para continuar. Se conservan los datos ingresados." | pass | pass | n/a | n/a | n/a |  |
| AR-17 when the email cannot be sent the person sees the server error and a retry sends at once | Error guessing (mail cannot be sent) | Server error shown; a retry sends the email | pass | pass | n/a | n/a | n/a |  |
| AR-18 with English chosen on Welcome the screen and the email are in English | Equivalence (language of the email) | Email in English (backend/lang/en/athlete_mail.php) | pass | pass | n/a | n/a | n/a |  |
| AR-19 the emailed link shows Verificando tu enlace, then the privacy notice and the password step with the roster name | Equivalence (valid link, N05-01) | /register/athlete?token=...: "Verificando tu enlace", "Espera mientras confirmamos tu registro de atleta." | pass | pass | n/a | n/a | n/a |  |
| AR-20 a link requested on the desktop opens on a phone that never saw the number step | State transition (link, other device) | Works in a session that never saw the number step | pass | pass | n/a | n/a | n/a | [Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19490187), fixed in `7dcd4c0` |
| AR-21 a link page with no token or an empty token says the link is not valid | Equivalence (link missing) | N05-02b: heading "Este enlace ya no es válido" | pass | pass | n/a | n/a | n/a |  |
| AR-22 a token of 255 characters and one of 256 both show the link is not valid | Boundary (token length 255 / 256, 2-value) | 255 and 256 characters both show the invalid-link screen | pass | pass | n/a | n/a | n/a | [Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19490197), fixed in `7dcd4c0` |
| AR-23 garbled and hostile tokens all show the link is not valid without errors or scripts | Equivalence (garbled and hostile token) | N05-02b each time, no 500, no script | pass | pass | n/a | n/a | n/a |  |
| AR-24 the 11th failed lookup is rate limited with the time to try again | Rate limit (11th failed lookup) | 429, "Intenta de nuevo a las HH:MM.", Continuar disabled until then | pass | pass | n/a | n/a | n/a |  |
| AR-25 a link one minute from expiring still works and one expired a second ago says Tu enlace venciÃ³ | Boundary (expiry, 2-value) | +1 min: AR-19 | pass | pass | n/a | n/a | n/a |  |
| AR-26 a link that was already used says Este enlace ya se usÃ³ with sign in and back | Equivalence (used link) | N05-03 "Este enlace ya se usó" | pass | pass | n/a | n/a | n/a |  |
| AR-27 an older link says to use the newest one and the newer link still works | Equivalence (replaced link) | N05-04 "Usa tu enlace más reciente" | pass | pass | n/a | n/a | n/a |  |
| AR-28 a record claimed after the link was sent says it could not be linked and shows the gym number | Equivalence (record claimed since the link) | N05-05 "No pudimos vincular este registro", "El registro de atleta ya fue reclamado." | pass | pass | n/a | n/a | n/a |  |
| AR-29 a record removed after the link was sent makes the link not valid | Equivalence (removed after the link) | A record removed after the link was sent makes the link not valid | pass | pass | n/a | n/a | n/a |  |
| AR-30 the API answers the link states in order: invalid, used, claimed, replaced, expired | Decision table (precedence) | Codes in order: invalid, used, claimed, replaced, expired | pass | pass | n/a | n/a | n/a |  |
| AR-31 offline the link page asks to connect, keeps Reintentar off, and checks again online | Offline (link page) | N05-06 "Verifica tu enlace", "Conéctate para verificar el enlace que recibiste por correo." | pass | pass | n/a | n/a | n/a |  |
| AR-32 a server error on the link check shows No pudimos verificar tu enlace and Reintentar checks again | Error guessing (5xx on validate) | N05-07 "No pudimos verificar tu enlace", "Ocurrió un problema al consultar tu registro." | pass | pass | n/a | n/a | n/a |  |
| AR-33 a signed-in member or staff cannot use the link page and the link stays unused | Permission state (signed-in visitor) | Registration routes answer 403 forbidden | pass | pass | n/a | n/a | n/a |  |
| AR-34 reloading the password step asks for the link again and Back from it leaves the link page without Verificando | State transition (refresh and Back) | Link checked again after a reload; one Back leaves the athlete link (/register) | pass | pass | n/a | n/a | n/a | [Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19490192), fixed in `7dcd4c0` |
| AR-35 passwords of 9 and 10 characters, a mismatch and 255 characters follow the rules | Equivalence, password rows | "Usa al menos 10 caracteres." / "Las contraseñas deben coincidir." | pass | pass | n/a | n/a | n/a |  |
| AR-36 photo rows: a taken or uploaded photo shows a preview and a photo error does not use up the link | Equivalence, photo rows | Same photo errors as paid registration, the link is not used up | pass | pass | n/a | n/a | n/a |  |
| AR-37 with the camera denied or missing only Subir foto is offered | Permission state (camera) | Only "Subir foto" with the drawn camera line | pass | pass | n/a | n/a | n/a |  |
| AR-38 Crear cuenta names each missing field, the full waiver opens and phone formats follow the rules | Decision table, waiver and contact | Same field errors as paid registration, full waiver opens | pass | pass | n/a | n/a | n/a |  |
| AR-39 a save error returns to the photo with the data kept and the second try creates the account | Error guessing (save error, then retry) | "No pudimos crear tu cuenta" then data kept | pass | pass | n/a | n/a | n/a |  |
| AR-40 a connection that drops during the save shows the save error and the link is not used until the retry works | Offline (drops during save) | Save error shown; the link stays valid for the retry | pass | pass | n/a | n/a | n/a |  |
| AR-41 a link that expires while the form is open returns to Tu enlace venciÃ³ and creates nothing | State transition (link expires while the form is open) | /athlete/complete answers athlete_link_expired: UI returns to /register/athlete showing N05-02 | pass | pass | n/a | n/a | n/a |  |
| AR-42 a link replaced or a record claimed while the form is open shows its screen and creates nothing | State transition (link replaced or claimed while open) | N05-04 or N05-05, nothing created | pass | pass | n/a | n/a | n/a |  |
| AR-43 an account created for the roster email meanwhile sends the person to the existing account screen | State transition (roster email got an account meanwhile) | Existing-account screen with the masked email, link unused | pass | pass | n/a | n/a | n/a |  |
| AR-44 with no current term the save fails with No pudimos crear tu cuenta and creates no user | State transition (no current term) | API 409 conflict | pass | pass | n/a | n/a | n/a |  |
| AR-45 a lost privacy acceptance returns to the privacy notice and creates nothing | State transition (privacy lost) | A lost privacy acceptance returns to the privacy notice and creates nothing | pass | pass | n/a | n/a | n/a |  |
| AR-46 two tabs sending the same link together create one account and the other shows the link was used | State transition (race, two tabs) | One 201 and one account | pass | pass | n/a | n/a | n/a |  |
| AR-47 the final step allows 10 calls a minute and the 11th gets a wait time; validate allows 30 | Rate limit (complete 10 per minute) | 11th call gets 429 and the retry time shows on the contact page | pass | pass | n/a | n/a | n/a | test fixed in f88dbfe |
| AR-48 sending the final step again after success is refused and no second account is made | State transition (repeat after success) | Sending the final step again after success is refused and no second account is made | pass | pass | n/a | n/a | n/a |  |
| AR-49 the install help lists the steps for the phone and Continuar or Ahora no reaches Check In | Equivalence (install help and Check In) | /check-in for an athlete | pass | pass | n/a | n/a | n/a |  |
| AR-50 signing in on a second device sends the first one to the sign in screen | Cross-device (phone to phone) | Signing in on a second device sends the first one to the sign in screen | pass | pass | n/a | n/a | n/a |  |
| AR-51 Staff dashboard roster screen | Cross-device (phone to dashboard) | Not built: "Atletas" in the dashboard menu has no screen | not built | not built | not built | not built | not built | dashboard roster screen not built |
| AR-52 Mi cuenta, tap "Soy atleta" | Not built: existing account adds athlete access | Not built: the row is inert (frontend/src/user/UserApp.tsx), no athlete_link route | not built | not built | not built | not built | not built | the "Soy atleta" row does nothing yet |
| AR-53 Run AR-01 using the phone's mail app to open the link | Device (viewport, mail app) | Link opens in the system browser or in-app browser | manual | manual | n/a | n/a | n/a | real phones only |

## 3. User sign in

Devices that ran: Android, iPhone. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| SI-01 a User signs in with the right password and reaches Check In with one tap | Equivalence (valid), end to end | /account heading "Mi cuenta" | pass | pass | n/a | n/a | n/a |  |
| SI-02 Mi cuenta shows the badge and access line of each account type | Equivalence (account types) | Mi cuenta shows the badge and access line from the table | pass | pass | n/a | n/a | n/a |  |
| SI-03 a wrong password shows the notice, keeps the email and stays on Sign in | Equivalence (wrong password) | Notice title "No pudimos iniciar sesión" | pass | pass | n/a | n/a | n/a |  |
| SI-04 an unknown email gets the same notice | Equivalence (unknown email) | An unknown email gets the same notice | pass | pass | n/a | n/a | n/a |  |
| SI-05 staff credentials do not sign in as a User | Equivalence (staff credentials) | Staff credentials do not sign in as a User | pass | pass | n/a | n/a | n/a |  |
| SI-06 the email is case insensitive and trimmed | Equivalence (email case and spaces) | The email is case insensitive and trimmed | pass | pass | n/a | n/a | n/a |  |
| SI-07 the password is case sensitive and never trimmed | Equivalence (password case and spaces) | The password is case sensitive and never trimmed | pass | pass | n/a | n/a | n/a |  |
| SI-08 empty fields are answered by the server under each missing field and focus the first | Decision table (empty fields) | "Este campo es obligatorio." under each missing field | pass | pass | n/a | n/a | n/a |  |
| SI-09 email format: nombre@ and nombre are invalid, a@b passes the format | Equivalence (email format) | Nombre@ and nombre: "Escribe un correo electrónico válido." (server email rule) | pass | pass | n/a | n/a | n/a |  |
| SI-10 email length: the field stops at 255 and the server refuses a 255 and a 256 character address | Boundary (email length 255 / 256, 2-value) | The field stops at 255; the server refuses longer addresses | pass | pass | n/a | n/a | n/a |  |
| SI-11 password length: 255 characters sign in, the 256th is refused | Boundary (password length 255 / 256, 2-value) | Password length: 255 characters sign in, the 256th is refused | pass | pass | n/a | n/a | n/a |  |
| SI-12 a non-ASCII password signs in | Equivalence (non-ASCII password) | A non-ASCII password signs in | pass | pass | n/a | n/a | n/a |  |
| SI-13 hostile input is shown as text, runs no script and never makes a 500 | Error guessing (hostile input) | Validation error or SI-03 notice, no script, no 500 | pass | pass | n/a | n/a | n/a |  |
| SI-14 nine failures still allow the right password, ten start a wait that ends | Boundary (lockout, 9 / 10 failures, 2-value) | After 9: the right password still signs in and clears the account counter | pass | pass | n/a | n/a | n/a |  |
| SI-15 the wait follows the email to another browser, whatever its case | State transition (lock follows the email) | Context 2 also gets the wait notice | pass | pass | n/a | n/a | n/a |  |
| SI-16 ten failures across ten emails lock the IP even for a right password | State transition (lock follows the IP) | Ten failures across ten emails lock the IP even for a right password | pass | pass | n/a | n/a | n/a |  |
| SI-17 a right password clears only the account count: 4 + 4 failures never lock | State transition (success clears only the account) | A right password clears only the account count: 4 + 4 failures never lock | pass | pass | n/a | n/a | n/a |  |
| SI-18 each new lockout waits longer: 60, 300, 900 and 3600 seconds | State transition (lock escalation) | Waits 60, 300, 900, 3600 s (Retry-After header) | pass | n/a | n/a | n/a | n/a |  |
| SI-19 a second phone replaces the first one | State transition (second phone replaces the first) | A second phone replaces the first one | pass | pass | n/a | n/a | n/a |  |
| SI-20 the replaced phone finds out by itself when it regains focus | State transition (replaced without reload) | The replaced phone finds out by itself when it regains focus | pass | pass | n/a | n/a | n/a |  |
| SI-21 ping-pong: the first phone signs in again and the second becomes the replaced one | State transition (ping-pong) | Ping-pong: the first phone signs in again and the second becomes the replaced one | pass | pass | n/a | n/a | n/a |  |
| SI-22 the open visit belongs to the account, so the second phone shows it | Cross-device (visit open on one phone) | Phone 1 is signed out by SI-19 | pass | flaky | n/a | n/a | n/a | flaky on iPhone, passed on retry |
| SI-23 an expired short session resumes from the remember cookie unless another device signed in | State transition (remembered session, needs-clock) | Still signed in (remember cookie recreates the session) | pass | pass | n/a | n/a | n/a |  |
| SI-24 after Cerrar sesiÃ³n every protected URL goes to Sign in and Back shows no account data | State transition (sign out) | Protected URLs go to Sign in; Back shows no account data | pass | pass | n/a | n/a | n/a |  |
| SI-25 a signed out person opening Check In or Gym lands on a plain Sign in | State transition (protected URL, signed out) | Redirect to /sign-in, plain notice-free form | pass | pass | n/a | n/a | n/a |  |
| SI-26 Sign in stays reachable while signed in and Back from Mi cuenta returns to the form without signing out | Exploratory (sign-in page while signed in, Back) | Form is shown again (no redirect) | pass | pass | n/a | n/a | n/a |  |
| SI-27 a deleted account cannot sign in and an open session ends | Equivalence (deleted account) | A deleted account cannot sign in and an open session ends | pass | pass | n/a | n/a | n/a |  |
| SI-28 an account without a password cannot sign in | Equivalence (no password) | An account without a password cannot sign in | pass | pass | n/a | n/a | n/a |  |
| SI-29 an English account opens in English and the language switch is saved on the account | Equivalence (language) | English UI after sign in ("Sign in", "My account") | pass | pass | n/a | n/a | n/a |  |
| SI-30 offline the form keeps its values and waits for the connection | Offline | Banner "Sin conexión · Datos no actualizados", button disabled | pass | pass | n/a | n/a | n/a |  |
| SI-31 a server error on sign in tells the person something went wrong and re-enables the button | Error guessing (5xx on sign in) | A server error on sign in shows a notice and the button works again | pass | pass | n/a | n/a | n/a |  |
| SI-32 an expired CSRF token is refreshed and the sign in goes through | Error guessing (CSRF expired) | Client fetches /api/sanctum/csrf-cookie and retries once | pass | pass | n/a | n/a | n/a |  |
| SI-33 a double tap sends one request and shows Iniciando sesiÃ³n | Error guessing (double submit) | Button shows "Iniciando sesión…" and is disabled | pass | pass | n/a | n/a | n/a |  |
| SI-34 the entry points: Welcome, the back arrow, Comenzar and the registration link | Decision table (entry points) | The entry points: Welcome, the back arrow, Comenzar and the registration link | pass | pass | n/a | n/a | n/a |  |
| SI-35 the password toggle shows and hides the text | Show and hide password | Field type changes | pass | pass | n/a | n/a | n/a |  |
| SI-36 a forgotten password is reset from the email link and the new password signs in | Equivalence (forgotten password, known email) | /recover-password "Recuperar contraseña" | pass | pass | n/a | n/a | n/a |  |
| SI-37 an unknown email gets the same received screen and no email | Equivalence (forgotten password, unknown email) | The same "Solicitud recibida" screen | pass | pass | n/a | n/a | n/a |  |
| SI-38 the recovery email field: empty, invalid and valid | Decision table (recover email field) | "Este campo es obligatorio." | pass | pass | n/a | n/a | n/a |  |
| SI-39 a server error on the recovery request shows the notice and keeps the email | Error guessing (5xx on recover) | Notice "No pudimos enviar la solicitud" / "Intenta de nuevo en unos momentos." | pass | pass | n/a | n/a | n/a |  |
| SI-40 the eleventh recovery request in a minute is refused with the wait notice | Boundary (recover rate limit, 10 / 11 per minute) | 11th: 429, notice "Espera antes de intentar de nuevo" and the time | pass | pass | n/a | n/a | n/a |  |
| SI-41 the broker sends one reset email per minute and a second one after the minute | Boundary (broker throttle 60 s) | The broker sends one reset email per minute and a second one after the minute | pass | pass | n/a | n/a | n/a |  |
| SI-42 a reset link works at 59 minutes and has expired at 61 | Boundary (link age 59 / 61 min, 2-value) | A reset link works at 59 minutes and has expired at 61 | pass | pass | n/a | n/a | n/a |  |
| SI-43 a used link shows the expired screen | Equivalence (used link) | A used link shows the expired screen | pass | pass | n/a | n/a | n/a |  |
| SI-44 a missing or wrong link shows the expired screen and the email case does not matter | Equivalence (garbled or missing link) | Missing or wrong: expired screen of SI-42 | pass | pass | n/a | n/a | n/a |  |
| SI-45 the link is checked first and the button waits for it | State transition (link validation) | "Estamos verificando el enlace…" with the button disabled until the link is confirmed | pass | pass | n/a | n/a | n/a |  |
| SI-46 the new password needs 10 characters and a matching confirmation | Boundary (new password 9 / 10, mismatch, 2-value) | The new password needs 10 characters and a matching confirmation | pass | pass | n/a | n/a | n/a |  |
| SI-47 a compromised new password shows the same field error | Equivalence (compromised new password) | A compromised new password shows the same field error | pass | pass | n/a | n/a | n/a |  |
| SI-48 a 255 character new password is saved and signs in | Boundary (new password 255) | A 255 character new password is saved and signs in | pass | pass | n/a | n/a | n/a |  |
| SI-49 a reset ends the other session and only the new password works | State transition (reset ends other sessions) | Phone 1: /sign-in with the replaced notice | pass | pass | n/a | n/a | n/a |  |
| SI-50 the reset link opened offline keeps the values and is checked again on reconnect | Offline (reset link) | Offline banner and the form values kept | pass | pass | n/a | n/a | n/a | [Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19488756), fixed in `d3d1eef` |
| SI-51 saving the new password does not sign in | State transition (reset ends on sign in) | /sign-in (no automatic sign in) | pass | pass | n/a | n/a | n/a |  |
| SI-52 a staff sign in survives the User signing in and out in the same browser | Permission state (staff and User in one browser) | A staff sign in survives the User signing in and out in the same browser | pass | pass | n/a | n/a | n/a |  |
| SI-53 an account that fails to load offers Reintentar | Error guessing (account fails to load) | "No pudimos cargar tu cuenta" / "Intenta de nuevo para ver tus datos." with "Reintentar" | pass | pass | n/a | n/a | n/a |  |
| SI-54 Staff dashboard | Cross-device (phone to staff dashboard) | Not built: no staff screen shows User sign-ins or sessions | not built | not built | not built | not built | not built | no staff screen shows sign-ins |
| SI-55 Sign in with the platform password manager and soft keyboard | Device (viewport, autofill, keyboard) | No horizontal scroll at 412x915 and 390x844 | manual | manual | n/a | n/a | n/a | real phones only |

## 4. Check In

Devices that ran: Android, iPhone. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| CI-01 paid student inside the gym gets the Gym ID | Equivalence partition (valid) | Lead "¡Tu entrada quedó registrada!", "Sesión activa", "Estudiante", entry time | pass | pass | n/a | n/a | n/a |  |
| CI-02 athlete gets the Gym ID with the sport and no student line | Equivalence partition (athlete) | "¡Tu entrada quedó registrada!", tag "Atleta", the sport, no "Estudiante" | pass | pass | n/a | n/a | n/a |  |
| CI-03 paid employee gets the Gym ID tagged Miembro with no group line | Equivalence partition (employee) | Gym ID with tag "Miembro" and no group line | pass | pass | n/a | n/a | n/a |  |
| CI-04 manual employee with a photo gets the Gym ID tagged Miembro | Equivalence partition (manual) | Gym ID "Miembro" with "Estudiante" or no line per member_group | pass | pass | n/a | n/a | n/a |  |
| CI-05 accuracy exactly 50 m is accepted | Boundary, accuracy (2-value, inside) | Gym ID opens (the API refuses only accuracy > 50) | pass | pass | n/a | n/a | n/a |  |
| CI-06 accuracy 50.01 m is refused as too coarse | Boundary, accuracy (2-value, outside) | Heading "Necesitamos mayor precisión" | pass | pass | n/a | n/a | n/a |  |
| CI-07 accuracy exactly 0 m is accepted | Boundary, accuracy (minimum) | Gym ID opens (validation is min:0) | pass | pass | n/a | n/a | n/a |  |
| CI-08 accuracy 500 m is refused as too coarse | Equivalence partition (coarse) | "Necesitamos mayor precisión" | pass | pass | n/a | n/a | n/a |  |
| CI-09 49.93 m north of the center is inside the radius | Boundary, radius (2-value, inside north) | Gym ID opens (49.93 m is within the 50 m radius) | pass | pass | n/a | n/a | n/a |  |
| CI-10 50.04 m north of the center is outside the radius | Boundary, radius (2-value, outside north) | Heading "Acércate al gimnasio" | pass | pass | n/a | n/a | n/a |  |
| CI-11 49.96 m east of the center is inside the radius | Boundary, radius (east, inside) | Gym ID opens | pass | pass | n/a | n/a | n/a |  |
| CI-12 50.07 m east of the center is outside the radius | Boundary, radius (east, outside) | "Acércate al gimnasio" | pass | pass | n/a | n/a | n/a |  |
| CI-13 one kilometer away is refused as outside | Equivalence partition (far outside) | "Acércate al gimnasio" | pass | pass | n/a | n/a | n/a |  |
| CI-14 outside, then inside: Intentar de nuevo opens the Gym ID with one visit | State transition (outside to inside) | Gym ID opens | pass | pass | n/a | n/a | n/a |  |
| CI-15 poor accuracy is reported before the distance | Decision table (check order: accuracy before boundary) | "Necesitamos mayor precisión", not "Acércate al gimnasio" | pass | pass | n/a | n/a | n/a |  |
| CI-16 denied location shows the permission screen and sends nothing | Permission state: denied (faked code 1) | Heading "Activa el permiso de ubicación" | pass | pass | n/a | n/a | n/a |  |
| CI-17 the real browser permission denial shows the same screen | Permission state: denied by the real browser | The real browser permission denial shows the same screen | pass | pass | n/a | n/a | n/a |  |
| CI-18 the location help dialog opens, closes and returns focus | Permission state: help dialog | The location help dialog opens, closes and returns focus | pass | pass | n/a | n/a | n/a | [issue #17 comment](https://github.com/Th3-Minorities/natatorio-gym-app/issues/17#issuecomment-6735696177), fixed in `8d1c3f7` |
| CI-19 denied, then granted: Reintentar asks the API and registers | Permission state: denied then granted | The app asks the API whether a session exists | pass | pass | n/a | n/a | n/a |  |
| CI-20 an unanswered permission prompt keeps the locating state | Permission state: prompt not answered | Title "Obteniendo ubicación", lead "Estamos procesando tu Check-in", button label "Obteniendo ubicación…" | pass | pass | n/a | n/a | n/a |  |
| CI-21 position unavailable (code 2) shows the unavailable screen | Permission state: position unavailable (code 2) | Heading "No pudimos obtener tu ubicación" | pass | pass | n/a | n/a | n/a |  |
| CI-22 position timeout (code 3) shows the unavailable screen | Permission state: timeout (code 3, the app waits 15 s) | Position timeout (code 3) shows the unavailable screen | pass | pass | n/a | n/a | n/a |  |
| CI-23 a browser with no geolocation shows the unavailable screen | Equivalence partition (no geolocation in the browser) | A browser with no geolocation shows the unavailable screen | pass | pass | n/a | n/a | n/a |  |
| CI-24 unavailable, then inside: Intentar de nuevo opens the Gym ID | State transition (unavailable then center) | Gym ID opens | pass | pass | n/a | n/a | n/a |  |
| CI-25 releasing at 900 ms cancels: no request, no refusal | Boundary, hold time (2-value, short) | Releasing at 900 ms cancels: no request, no refusal | pass | pass | n/a | n/a | n/a | test fixed in f88dbfe |
| CI-26 holding 1100 ms sends one request and opens the Gym ID | Boundary, hold time (2-value, long) | Request sent once | pass | pass | n/a | n/a | n/a |  |
| CI-27 moving focus away before one second cancels the hold | State transition (press interrupted by blur) | Moving focus away before one second cancels the hold | pass | pass | n/a | n/a | n/a |  |
| CI-28 holding Enter with auto-repeat sends one request | Keyboard | Holding Enter with auto-repeat sends one request | pass | pass | n/a | n/a | n/a |  |
| CI-29 a click with no pointer press (screen reader) registers at once | Assistive technology | Registers at once, no hold needed | pass | pass | n/a | n/a | n/a |  |
| CI-30 a touch long press registers and opens no context menu | Device: touch long press | No context menu or callout opens | pass | pass | n/a | n/a | n/a |  |
| CI-31 pressing again while registering sends exactly one request | State transition (double press while busy) | Button has aria-disabled | pass | pass | n/a | n/a | n/a |  |
| CI-32 a paid member whose term ended is refused | Equivalence partition (no authorization: term ended) | Heading "Tu acceso no está vigente" | pass | pass | n/a | n/a | n/a |  |
| CI-33 an account with no authorization row is refused | Equivalence partition (no authorization row) | An account with no authorization row is refused | pass | pass | n/a | n/a | n/a |  |
| CI-34 a revoked paid authorization is refused | Equivalence partition (revoked paid) | A revoked paid authorization is refused | pass | pass | n/a | n/a | n/a |  |
| CI-35 a removed athlete gets the athlete refusal with a text-only action | Equivalence partition (removed athlete) | Athlete variant: "Tu acceso de atleta no está vigente" | pass | pass | n/a | n/a | n/a |  |
| CI-36 Revisar mi acceso opens Mi cuenta without an active authorization | State transition (link to the account) | /account Mi cuenta with caption "Sin autorización activa" | pass | pass | n/a | n/a | n/a |  |
| CI-37 the last day of the term still allows Check In | Boundary, term end (2-value, last day) | Gym ID opens (terms include ends_on) | pass | pass | n/a | n/a | n/a |  |
| CI-38 the day after the term ended refuses Check In | Boundary, term end (2-value, day after) | "Tu acceso no está vigente" | pass | pass | n/a | n/a | n/a |  |
| CI-39 an authorization only in a future term is refused | Equivalence partition (authorization only in a future term) | "Tu acceso no está vigente" | pass | pass | n/a | n/a | n/a |  |
| CI-40 a missing term photo asks for a new photo | Equivalence partition (term photo missing) | Heading "Necesitamos una foto nueva" | pass | pass | n/a | n/a | n/a |  |
| CI-41 a pending photo asks for a new photo | Equivalence partition (photo pending) | Heading "Tu foto necesita actualizarse" | pass | pass | n/a | n/a | n/a |  |
| CI-42 after the pending photo is cleared, a reload and a new hold open the Gym ID | State transition (photo pending cleared) | Gym ID opens | pass | pass | n/a | n/a | n/a |  |
| CI-43 the authorization is checked before the location | Decision table (order: authorization before location) | "Tu acceso no está vigente", not "Acércate al gimnasio" | pass | pass | n/a | n/a | n/a |  |
| CI-44 the photo is checked before the location | Decision table (order: photo before location) | "Tu foto necesita actualizarse" | pass | pass | n/a | n/a | n/a |  |
| CI-45 a closure is checked before the location | Decision table (order: closed before location) | Heading "El gimnasio está cerrado" | pass | pass | n/a | n/a | n/a |  |
| CI-46 a closure shows the neutral closed screen | Equivalence partition (gym closed by a closure) | Heading "El gimnasio está cerrado" | pass | pass | n/a | n/a | n/a |  |
| CI-47 two minutes before closing time the gym is open | Boundary, hours (2-value, open) | Gym ID opens | pass | pass | n/a | n/a | n/a |  |
| CI-48 two minutes after closing time the gym is closed | Boundary, hours (2-value, closed) | "El gimnasio está cerrado" | pass | pass | n/a | n/a | n/a |  |
| CI-49 a member during an athletes-only period sees the exclusive view | Equivalence partition (member in an athletes-only period) | The screen becomes the exclusive view: heading "Ahora entrenan los atletas" | pass | pass | n/a | n/a | n/a |  |
| CI-50 an athlete during an athletes-only period gets the Gym ID | Equivalence partition (athlete in an athletes-only period) | Gym ID opens ("Atleta") | pass | pass | n/a | n/a | n/a |  |
| CI-51 a manual member during an athletes-only period sees the exclusive view | Equivalence partition (manual member in the period) | Exclusive view as in CI-49 (E-126) | pass | pass | n/a | n/a | n/a |  |
| CI-52 the exclusive view returns to the hold button when the period ends | State transition (period ends while the exclusive screen is open) | Screen returns to "¿Listo para entrenar?" with the hold button | pass | pass | n/a | n/a | n/a |  |
| CI-53 an athletes-only period starting in 59 minutes shows the notice | Boundary, notice window (2-value, shown) | Ready view shows the notice "Próximo horario exclusivo de atletas" | pass | pass | n/a | n/a | n/a |  |
| CI-54 an athletes-only period starting in 61 minutes shows no notice | Boundary, notice window (2-value, hidden) | An athletes-only period starting in 61 minutes shows no notice | pass | flaky | n/a | n/a | n/a | flaky on iPhone, passed on retry |
| CI-55 a closure wins over an athletes-only period | Decision table (closure over athletes-only) | "El gimnasio está cerrado" (closure wins) | pass | pass | n/a | n/a | n/a |  |
| CI-56 an athletes-only period outside regular hours opens the gym for athletes only | Decision table (athletes-only outside regular hours opens the gym for athletes) | Gym ID opens for A | pass | flaky | n/a | n/a | n/a | flaky on iPhone, passed on retry |
| CI-57 a repeated Check In through the API returns the same visit | State transition (repeated Check In through the API) | A repeated Check In through the API returns the same visit | pass | n/a | n/a | n/a | n/a |  |
| CI-58 reloading at the Gym ID keeps the entry time | State transition (reload at Gym ID) | Lead "Tu entrada está registrada", same entry time | pass | pass | n/a | n/a | n/a |  |
| CI-59 with an open visit the API ignores bad location numbers | State transition (repeat with bad location numbers) | With an open visit the API ignores bad location numbers | pass | n/a | n/a | n/a | n/a |  |
| CI-60 a second phone on the same account shows the same Gym ID | State transition (second phone, same account) | Phone 2 shows the same Gym ID and entry time without asking for location | pass | pass | n/a | n/a | n/a |  |
| CI-61 the first phone returns to sign-in after a second sign-in | State transition (first phone after a second sign-in) | Phone 1 goes to /sign-in with the notice | pass | pass | n/a | n/a | n/a |  |
| CI-62 Back after Check In shows Mi cuenta and Forward shows the same Gym ID | State transition (invalid: Back after Check In) | Back shows Mi cuenta | pass | pass | n/a | n/a | n/a |  |
| CI-63 two simultaneous requests create one visit | State transition (two simultaneous requests) | One 201 and one 200 with the same session id | pass | n/a | n/a | n/a | n/a |  |
| CI-64 re-entry after a desk check-out is a new visit | State transition (re-entry after a check-out) | A new session with a different id and a new entry time | pass | pass | n/a | n/a | n/a |  |
| CI-65 offline when pressing shows the connection screen and sends nothing | Network: offline when pressing | Heading "Necesitas conexión", text "Conéctate a internet para verificar y registrar tu entrada." | pass | pass | n/a | n/a | n/a |  |
| CI-66 offline at page load shows the connection screen | Network: offline at page load | "Necesitas conexión" with "Reintentar conexión" | pass | pass | n/a | n/a | n/a | [issue #17 comment](https://github.com/Th3-Minorities/natatorio-gym-app/issues/17#issuecomment-6735515910), fixed in `8d1c3f7` |
| CI-67 back online, the app recovers and a new hold opens the Gym ID after asking the API first | State transition (offline then back online) | The app recovers and a new hold opens the Gym ID | pass | pass | n/a | n/a | n/a |  |
| CI-68 an aborted request shows the connection screen | Network: POST aborted | "Necesitas conexión" screen | pass | pass | n/a | n/a | n/a |  |
| CI-69 a lost response is recovered by the retry without a second visit | Network: response lost after the server saved the visit | The retry's GET finds the session | pass | pass | n/a | n/a | n/a |  |
| CI-70 a server error shows the send error screen | Network: server error 500 on POST | Heading "No pudimos enviar la solicitud" | pass | pass | n/a | n/a | n/a |  |
| CI-71 an HTML proxy page (502) is treated as offline | Network: proxy page instead of JSON (502) | Treated as offline: "Necesitas conexión" | pass | pass | n/a | n/a | n/a |  |
| CI-72 ten requests in a minute are all answered, none throttled | Boundary, rate limit (2-value, 10th request) | All ten answered 403 "check_in_outside_boundary" (not throttled) | pass | n/a | n/a | n/a | n/a |  |
| CI-73 the eleventh request in a minute shows the wait screen | Boundary, rate limit (2-value, 11th request) | Heading "Espera antes de intentar de nuevo" | pass | pass | n/a | n/a | n/a |  |
| CI-74 a Check In from a replaced session goes to sign-in | State transition (session ended: sign-in required) | /sign-in with "Iniciaste sesión en otro dispositivo" | pass | pass | n/a | n/a | n/a |  |
| CI-75 signed out, Check In redirects to sign-in and sign-in lands on Mi cuenta | Permission: signed out | Redirected to /sign-in | pass | pass | n/a | n/a | n/a |  |
| CI-76 a staff session is refused on the user Check In endpoint | Permission: staff cookie on the user endpoint | A staff session is refused on the user Check In endpoint | pass | n/a | n/a | n/a | n/a |  |
| CI-77 out-of-range numbers are a validation error and create no visit | Boundary, validation | Out-of-range numbers are a validation error and create no visit | pass | n/a | n/a | n/a | n/a |  |
| CI-78 missing location numbers answer location_required | Equivalence partition (missing location numbers) | Missing location numbers answer location_required | pass | n/a | n/a | n/a | n/a |  |
| CI-79 an English account sees the English Check In texts | Device: account language English | Texts from en.ts checkIn and gym | pass | pass | n/a | n/a | n/a |  |
| CI-80 the tab bar opens each screen, marks the current tab and focuses the h1 | Device: tab bar | Each screen opens | pass | pass | n/a | n/a | n/a |  |
| CI-81 coordinates are never stored or logged | State transition (coordinates are not stored) | Row has no latitude or longitude column | pass | pass | n/a | n/a | n/a |  |
| CI-82 a desk check-out ends the visit on the phone | Cross-device: phone Check In, desk check-out ends the visit | Phone shows "Tu visita ha terminado" (see end-of-visit.md EV-01) | pass | pass | n/a | n/a | n/a |  |
| CI-83 an Administrator check-out also ends the visit | Cross-device: admin role also checks out | An Administrator check-out also ends the visit | pass | pass | n/a | n/a | n/a |  |

## 5. Gym ID and occupancy

Devices that ran: Android, iPhone. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| GI-01 a student member sees the full Gym ID after Check In | Equivalence partition (member student card) | "Sesión activa", name, email line, tag "Miembro", "Estudiante", "Entrada registrada" with the time | pass | pass | n/a | n/a | n/a |  |
| GI-02 an athlete sees the Atleta tag and the sport, not Estudiante | Equivalence partition (athlete card) | Tag "Atleta", the sport line (for example "Voleibol"), no "Estudiante", athlete art | pass | pass | n/a | n/a | n/a |  |
| GI-03 an employee sees Miembro and no group line | Equivalence partition (employee card) | Tag "Miembro", no group line | pass | pass | n/a | n/a | n/a |  |
| GI-04 an account with no waiver name shows the email as the name and no authorization mark | Equivalence partition (no waiver name) | The card shows the email as the name, no second email line | pass | pass | n/a | n/a | n/a |  |
| GI-05 the member photo is shown from /api/user/photo | Equivalence partition (photo present) | Photo shown from /api/user/photo | pass | pass | n/a | n/a | n/a |  |
| GI-06 a photo that fails to load is replaced by the person icon | Equivalence partition (photo fails) | The person icon replaces the photo | pass | pass | n/a | n/a | n/a |  |
| GI-07 the duration starts near zero and advances once per second | Boundary, duration start | Starts at 00:00:0x, advances once per second, format HH:MM:SS | pass | pass | n/a | n/a | n/a | [Discussion](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158#discussioncomment-19501881), fixed in `34508d1` |
| GI-08 a wrong device clock does not change the duration | Boundary, device clock wrong | Duration is the server's (small), not 3 hours | pass | pass | n/a | n/a | n/a |  |
| GI-09 a reload keeps the entry time and the duration keeps counting | State transition (reload) | Lead "Tu entrada está registrada", same entry time and a duration that kept counting | pass | pass | n/a | n/a | n/a |  |
| GI-10 the card polls /api/user/check-in every 25 seconds and stays the same | State transition (poll while open) | One GET /api/user/check-in every 25 s | pass | pass | n/a | n/a | n/a |  |
| GI-11 a hidden tab sends no poll and refreshes once when it is shown again | State transition (hidden tab) | No request while hidden | pass | pass | n/a | n/a | n/a |  |
| GI-12 offline, the Gym ID is marked not valid now | State transition (offline, Gym ID) | "No válida ahora", lead "Restablece la conexión para validar tu tarjeta." | pass | pass | n/a | n/a | n/a |  |
| GI-13 back online, the Gym ID is valid again and the duration resumes | State transition (back online) | "Sesión activa" returns after the app revalidates | pass | pass | n/a | n/a | n/a |  |
| GI-14 opened offline, the app shows the connection screen and never a stored Gym ID | Permission/state: cold open offline | No card: heading "Check-in" with "Necesitas conexión" | pass | pass | n/a | n/a | n/a |  |
| GI-15 a failed poll with the browser online marks the Gym ID stale | Network: GET fails while the browser says online | Stale card as in GI-12 | pass | pass | n/a | n/a | n/a |  |
| GI-16 a 500 on the poll marks the card stale and a good answer makes it current | Network: server error 500 on the poll | Stale card as in GI-12 | pass | pass | n/a | n/a | n/a |  |
| GI-17 a replaced session goes to sign-in on the next poll of the Gym ID | State transition (session replaced, 401) | /sign-in with "Iniciaste sesión en otro dispositivo" | pass | pass | n/a | n/a | n/a |  |
| GI-18 an athletes-only period inside the visit shows the upcoming notice | Equivalence partition (athletes-only period starts within the visit) | Card stays "Sesión activa" | pass | pass | n/a | n/a | n/a |  |
| GI-19 a period already active does not cut the visit and the notice says exclusive | Equivalence partition (period already active, visit open) | The visit is not cut | pass | pass | n/a | n/a | n/a |  |
| GI-20 a period starting before the visit ends is shown, one starting after is not | Boundary, notice window | The +119 period is shown (it starts before the visit ends) | pass | pass | n/a | n/a | n/a |  |
| GI-21 Gimnasio and back keeps the entry time and the counting duration | State transition (Gym ID to Gimnasio and back) | The card returns with the same entry time and a duration that kept counting | pass | pass | n/a | n/a | n/a |  |
| GI-22 Back from the Gym ID opens Gimnasio and Forward returns the card | State transition (Back button) | Back from the Gym ID opens Gimnasio and Forward returns the card | pass | pass | n/a | n/a | n/a |  |
| GI-23 an English account sees the English Gym ID and Gimnasio | Device: English | Texts from en.ts (checkIn.sessionActive, gym.title ...) | pass | pass | n/a | n/a | n/a |  |
| GI-24 a staff correction that ended the visit early shows the ended summary | Equivalence partition (staff correction, ended early) | "Tu visita ha terminado" | pass | pass | n/a | n/a | n/a |  |
| GI-25 a voided visit disappears from the phone | Equivalence partition (staff correction, void) | The voided visit disappears: the screen shows the previous ended visit or "¿Listo para entrenar?" | pass | pass | n/a | n/a | n/a |  |
| GI-26 the card switches to the ended summary after the 2-hour mark | Boundary, duration at 2 hours (live) | Duration passes 01:59:59 | pass | pass | n/a | n/a | n/a |  |
| GI-27 Gimnasio before the visit shows the count and the level | Equivalence partition (Gimnasio before the visit) | H1 "Gimnasio", "Tu espacio para entrenar", h2 "Ocupación estimada", count, "personas" | pass | pass | n/a | n/a | n/a |  |
| GI-28 the count rises by one after a Check In | State transition (count after a Check In) | Count is base + 1 | pass | pass | n/a | n/a | n/a |  |
| GI-29 the count drops by one after a desk check-out | State transition (count after a desk check-out) | Count is base again | pass | pass | n/a | n/a | n/a |  |
| GI-30 an athlete counts like a member | Equivalence partition (athlete counts like a member) | Count is base + 1 (REQ-F-41) | pass | pass | n/a | n/a | n/a |  |
| GI-31 an empty gym shows 0 personas, Baja and an empty bar | Boundary, level (empty gym) | "0" "personas" "Baja", bar width 0 | pass | pass | n/a | n/a | n/a |  |
| GI-32 a count of 13 is Baja | Boundary, level (2-value, top of Baja) | "13" and badge "Baja" (13 | pass | pass | n/a | n/a | n/a |  |
| GI-33 a count of 14 is Moderada | Boundary, level (2-value, bottom of Moderada) | "14" and badge "Moderada" | pass | pass | n/a | n/a | n/a |  |
| GI-34 a count of 26 is Moderada | Boundary, level (2-value, top of Moderada) | "26" and "Moderada" (26 is at most 26.67) | pass | pass | n/a | n/a | n/a |  |
| GI-35 a count of 27 is Alta | Boundary, level (2-value, bottom of Alta) | "27" and "Alta" | pass | pass | n/a | n/a | n/a |  |
| GI-36 the bar fills at 40 and stays full at 41 while the number grows | Boundary, bar at maximum | The bar fills at 40 and stays full at 41 while the number grows | pass | pass | n/a | n/a | n/a |  |
| GI-37 a visit that reached the 2-hour mark is not counted before or after the scheduler | State transition (count after the 2-hour close) | Count is base - 1 before and after the scheduler | pass | pass | n/a | n/a | n/a |  |
| GI-38 a visit one moment before the 2-hour mark is still counted | Boundary, 2-hour close (2-value, 1 s before) | The visit is still counted | pass | pass | n/a | n/a | n/a |  |
| GI-39 a closure drops the visits that began before it at once | State transition (count after a closure) | Every visit that started before the closure drops out of the count at once | pass | pass | n/a | n/a | n/a |  |
| GI-40 a visit past the end of its term is not counted | State transition (count after the end of the term) | That visit is not counted | not run | not run | n/a | n/a | n/a | needs the clock between 00:00 and 01:25 Puerto Rico time |
| GI-41 a staff void drops the count by one | State transition (count after a staff void) | Count drops by one | pass | pass | n/a | n/a | n/a |  |
| GI-42 the count follows another phone Check In at the next poll | State transition (poll updates the number) | Count rises by one, "Actualizado a las" shows a later time | pass | pass | n/a | n/a | n/a |  |
| GI-43 a hidden tab on Gimnasio sends no poll and refreshes once when shown | State transition (hidden tab on Gimnasio) | No polls while hidden | pass | pass | n/a | n/a | n/a |  |
| GI-44 offline, Gimnasio hides the number and says Sin conexiÃ³n | State transition (offline on Gimnasio) | No number and no bar | pass | pass | n/a | n/a | n/a |  |
| GI-45 back online, Gimnasio shows the count and level again | State transition (back online on Gimnasio) | Count and level return, "Actualizado a las {time}" | pass | pass | n/a | n/a | n/a |  |
| GI-46 opened offline, Gimnasio says Sin conexiÃ³n with no number and no request | State transition (cold open offline) | "Sin conexión", caption "Dato no actualizado", no number, no request | pass | pass | n/a | n/a | n/a |  |
| GI-47 a server error on occupancy shows the error state and no stale number | Network: server error on occupancy | "No pudimos actualizar", caption "Dato no actualizado", no stale number | pass | pass | n/a | n/a | n/a |  |
| GI-48 the count returns after a good answer following a failed poll | Network: recovery after a failed poll | The count returns after a good answer following a failed poll | pass | pass | n/a | n/a | n/a |  |
| GI-49 Gimnasio shows the loading frame until occupancy answers | State transition (loading) | Skeleton and "Actualizando ocupación…" until the answer | pass | pass | n/a | n/a | n/a |  |
| GI-50 a replaced session goes to sign-in on the next poll of Gimnasio | State transition (401 on Gimnasio) | /sign-in with "Iniciaste sesión en otro dispositivo" | pass | pass | n/a | n/a | n/a |  |
| GI-51 signed out, Gimnasio redirects to sign-in | Permission: signed out | Redirect to /sign-in | pass | pass | n/a | n/a | n/a |  |
| GI-52 a staff session is refused on the occupancy endpoint | Permission: staff session | A staff session is refused on the occupancy endpoint | pass | n/a | n/a | n/a | n/a |  |
| GI-53 the occupancy endpoint answers count, max and updated_at | Equivalence partition (API shape) | The occupancy endpoint answers count, max and updated_at | pass | n/a | n/a | n/a | n/a |  |
| GI-54 the tab bar marks the current tab and focuses the h1 from Gimnasio | Device: tab bar on Gimnasio | Aria-current="page" follows the tab | pass | pass | n/a | n/a | n/a |  |
| GI-55 an English account sees the English Gimnasio at a count of 14 | Device: English | En.ts gym texts | pass | pass | n/a | n/a | n/a |  |
| GI-56 two Check Ins at the same moment both count | Boundary, simultaneous Check Ins | Count is base + 2 after one poll | pass | pass | n/a | n/a | n/a |  |
| GI-57 a Check In on one phone raises the count on another phone without a reload | Cross-device: phone Check In shows on another phone's Gimnasio | Phone 2 count is base + 1 within 25 s without a reload | pass | pass | n/a | n/a | n/a |  |
| GI-58 a desk check-out ends the visit on one phone and lowers the count on the other | Cross-device: desk check-out updates both phones | Phone 1 card becomes "Tu visita ha terminado" within 25 s | pass | pass | n/a | n/a | n/a |  |

## 6. End of a visit

Devices that ran: Android, iPhone. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| EV-01 a desk check-out ends the visit on the phone after a reload | Equivalence partition (desk check-out, member) | Heading "Check-in", lead "Tu visita ha terminado", "Sesión finalizada", "Entrada" and time | pass | pass | n/a | n/a | n/a |  |
| EV-02 the open card turns into the ended view on its own, with no tap | State transition (no reload: the poll) | The card turns into the ended view without any tap | pass | pass | n/a | n/a | n/a |  |
| EV-03 a tab that becomes visible shows the ended view at once | State transition (tab becomes visible) | The ended view appears at once | pass | pass | n/a | n/a | n/a |  |
| EV-04 a check-out during an offline phone shows the ended view after reconnecting, never an active card | State transition (phone offline during the check-out) | While offline the card says "No válida ahora" | pass | pass | n/a | n/a | n/a |  |
| EV-05 on Gimnasio the count falls after a check-out and the Check-in tab shows the ended view | State transition (phone on Gimnasio during the check-out) | The count falls to base | pass | pass | n/a | n/a | n/a |  |
| EV-06 a visit that ends while the person is on Mi cuenta shows as ended from the Check-in tab | State transition (phone on Mi cuenta) | The ended view (the visit ended while the person was elsewhere) | pass | pass | n/a | n/a | n/a |  |
| EV-07 a phone that was closed and reopened shows the ended view | State transition (app closed, reopened) | The ended view | pass | pass | n/a | n/a | n/a |  |
| EV-08 an athlete sees the ended view with the Atleta tag and the sport | Equivalence partition (athlete) | The ended view with the athlete variant: tag "Atleta", the sport line | pass | pass | n/a | n/a | n/a |  |
| EV-09 an employee sees the ended view tagged Miembro with no group line | Equivalence partition (employee) | Ended view with tag "Miembro" and no group line | pass | pass | n/a | n/a | n/a |  |
| EV-10 Continuar returns to the ready screen with the hold button | State transition (Continuar) | Lead "¿Listo para entrenar?" and the hold button "Mantén presionado para entrar" | pass | pass | n/a | n/a | n/a |  |
| EV-11 after Continuar a reload still shows the ready screen | State transition (Continuar then reload) | Still "¿Listo para entrenar?" | pass | pass | n/a | n/a | n/a |  |
| EV-12 another browser of the same person still shows the ended view | State transition (another browser) | The ended view shows again (the dismissal is per browser) | pass | pass | n/a | n/a | n/a |  |
| EV-13 with storage blocked Continuar works but the ended view returns after a reload | Permission: storage blocked | Ready screen; the ended view returns after a reload | pass | pass | n/a | n/a | n/a |  |
| EV-14 offline, Continuar is disabled and the offline banner shows | Network: Continuar offline | The button is disabled | pass | pass | n/a | n/a | n/a |  |
| EV-15 Continuar after a Check In on another phone sends the first phone to sign in | State transition (invalid: Check In on another phone before Continuar) | Phone 1 is told to sign in again (session replaced) | pass | pass | n/a | n/a | n/a |  |
| EV-16 after Continuar a new hold starts a second visit and the count rises again | State transition (Check In again, same day) | A new visit: new session id and entry time | pass | pass | n/a | n/a | n/a |  |
| EV-17 a visit checked out in the same second shows a duration of at most two seconds | Boundary, shortest visit | "Duración total" 00:00:00 to 00:00:02, "Salida" not before "Entrada" | pass | pass | n/a | n/a | n/a |  |
| EV-18 a desk check-out just inside the two hours succeeds and the phone shows the desk reason | Boundary, desk check-out at 2 hours (2-value, inside) | 200, session.status checked_out, end_reason checked_out | pass | pass | n/a | n/a | n/a |  |
| EV-19 a desk check-out at exactly two hours is refused and the phone shows the automatic close | Boundary, desk check-out at 2 hours (2-value, at the limit) | Check-out at two hours is refused; the phone shows the automatic close | pass | pass | n/a | n/a | n/a |  |
| EV-20 a second check-out is refused and keeps the first end time and the first desk account | State transition (second check-out) | Second check-out refused; the first end time is kept | pass | pass | n/a | n/a | n/a |  |
| EV-21 Staff and Administrator can both check out and neither writes an audit entry | Permission: both desk roles | Staff and Administrator can both check out and neither writes an audit entry | pass | n/a | n/a | n/a | n/a |  |
| EV-22 a guest and a member cookie are refused as unauthenticated | Permission: not the desk | A guest and a member cookie are refused as unauthenticated | pass | n/a | n/a | n/a | n/a |  |
| EV-23 a deactivated Staff account can no longer check out | Permission: deactivated staff | The call is refused (401 or 403) | pass | n/a | n/a | n/a | n/a |  |
| EV-24 invalid ids are refused before any visit changes | Equivalence partition (invalid ids) | Unknown id 404 not_found | pass | n/a | n/a | n/a | n/a |  |
| EV-25 two simultaneous check-outs give one success and one refusal with one end time | State transition (concurrent check-outs) | One 200, one 409 | pass | n/a | n/a | n/a | n/a |  |
| EV-26 a visit past two hours is shown as automatically closed before the scheduler runs | Equivalence partition (2-hour close, phone reads it) | "Tu visita ha terminado", reason "La sesión se cerró automáticamente." | pass | pass | n/a | n/a | n/a |  |
| EV-27 the scheduler after the close changes nothing on the phone and leaves ended_at empty | Idempotence (scheduler after the close) | The scheduler after the close changes nothing on the phone and leaves ended_at empty | pass | pass | n/a | n/a | n/a |  |
| EV-28 a card open at 1:59:40 becomes the ended view within one poll after the two hours | Boundary, phone running into the close | Duration passes 01:59:59 | pass | pass | n/a | n/a | n/a |  |
| EV-29 five seconds before the two hours the card is still active | Boundary, 2 hours (2-value, 5 s before) | Still "Sesión activa" | pass | pass | n/a | n/a | n/a |  |
| EV-30 a Check In right after the two-hour close starts a new visit with no conflict | State transition (Check In right after the close) | A new visit starts | pass | pass | n/a | n/a | n/a |  |
| EV-31 a closure that starts during the visit ends it at the closure time | Equivalence partition (closure starts during the visit) | "Tu visita ha terminado", reason "La sesión terminó por cierre del gimnasio." | pass | pass | n/a | n/a | n/a |  |
| EV-32 a closure scheduled for later leaves the visit active | Equivalence partition (closure scheduled for later) | Still "Sesión activa" | pass | pass | n/a | n/a | n/a |  |
| EV-33 a closure that was over before the visit began leaves it active | Equivalence partition (closure over before the visit; weekly row) | Still "Sesión activa" | pass | pass | n/a | n/a | n/a |  |
| EV-34 during the closure Check In says the gym is closed, and after it the Gym ID opens | State transition (Check In during and after the closure) | Closed during the closure; the Gym ID opens after it | pass | pass | n/a | n/a | n/a |  |
| EV-35 a visit that began on the last evening of a past term is shown as closed at midnight | Equivalence partition (end of term) | "Tu visita ha terminado", "La sesión terminó por cierre del gimnasio." | pass | pass | n/a | n/a | n/a |  |
| EV-36 an athlete whose visit ended with the term sees the athlete view and can still Check In | Equivalence partition (end of term, athlete) | The athlete ended view, same reason | pass | pass | n/a | n/a | n/a |  |
| EV-37 a visit staff ended early shows the desk reason | Equivalence partition (staff ended it early; no API) | Ended view with "Tu salida fue registrada por el personal." | pass | pass | n/a | n/a | n/a |  |
| EV-38 a voided visit is not shown as ended | Equivalence partition (staff voided it; no API) | A voided visit is not shown as ended | pass | pass | n/a | n/a | n/a |  |
| EV-39 an athletes-only period that starts during the visit does not cut it | State transition (athletes-only period starts during the visit) | An athletes-only period that starts during the visit does not cut it | pass | pass | n/a | n/a | n/a |  |
| EV-40 signing out and in again keeps the visit open and the desk can still end it | State transition (sign out while the visit is open) | The visit is still open: "Sesión activa" with the same entry time | pass | pass | n/a | n/a | n/a |  |
| EV-41 with a second phone, the desk check-out ends the visit on the new phone and signs the old one out | Cross-device: second phone, desk check-out | Phone 2 shows the ended view | pass | pass | n/a | n/a | n/a |  |
| EV-42 a desk check-out of one person does not touch another person inside | Cross-device: desk check-out of one person does not touch another | M's phone ends | pass | pass | n/a | n/a | n/a |  |
| EV-43 the count on Gimnasio falls by one after a desk check-out | Cross-device: occupancy after a desk check-out | Count is base | pass | pass | n/a | n/a | n/a |  |
| EV-44 a failed refresh on Continuar keeps the ended view and shows the offline state | Network: the phone's Continuar request fails | The app does not dismiss on a failed refresh | pass | pass | n/a | n/a | n/a |  |
| EV-45 an English account sees the three end reasons in English | Device: English | An English account sees the three end reasons in English | pass | pass | n/a | n/a | n/a |  |
| EV-46 the tab bar leads away and back and the ended view returns until Continuar | Device: tab bar on the ended view | The ended view returns until "Continuar" is pressed | pass | pass | n/a | n/a | n/a |  |
| EV-47 every visit that already ended refuses a second check-out and stays as it was | Decision table (check-out of a visit that already ended) | Every visit that already ended refuses a second check-out and stays as it was | pass | n/a | n/a | n/a | n/a |  |

## 7. App base

Devices that ran: Android, iPhone, Desktop (Chrome), Firefox, Safari. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| AB-01 install help on Android opens the Android tab with the Chrome steps and no install button | Equivalence partition (Android user agent) | Tab Android has aria-selected=true | pass | n/a | n/a | n/a | n/a |  |
| AB-02 install help on iPhone opens the iPhone tab with the Safari steps and no install button | Equivalence partition (iPhone user agent) | Tab iPhone selected | n/a | pass | n/a | n/a | n/a |  |
| AB-03 the tabs swap the panel and keep the chosen tab | Equivalence partition (tab switch) | Each click moves aria-selected and swaps the panel, the other panel's texts are gone | pass | pass | n/a | n/a | n/a |  |
| AB-04 the arrow keys, Home and End move the selection and the focus | Boundary values (keyboard end points) | Wraps around: ArrowRight on Android goes to iPhone, ArrowLeft on iPhone goes to Android | pass | pass | n/a | n/a | n/a | test fixed in f88dbfe |
| AB-05 an iPad that sends a Mac user agent opens the Android tab and can still read the Safari steps | Boundary / invalid input (iPad Safari sends a Macintosh user agent) | The Android tab is the default and iPhone can be chosen | n/a | pass | n/a | n/a | n/a |  |
| AB-06 from Mi cuenta the install help keeps the bottom navigation, has no exit link and returns to Mi cuenta | State transition (entry from Mi cuenta) | URL /install, bottom navigation visible | pass | pass | n/a | n/a | n/a |  |
| AB-07 right after registration the install help has the large title, the green header and an exit to Check In per tab | State transition (entry right after registration) | Title h1 Instala la app | pass | pass | n/a | n/a | n/a |  |
| AB-08 leaving the install help with no session sends the person to sign in | State transition (invalid: no session on exit) | /check-in is protected, the 401 sends the person to /sign-in | pass | pass | n/a | n/a | n/a |  |
| AB-09 a prompt from the browser shows the install button on the Android tab only and the app takes the event | State transition (prompt arrives) | Button Instalar app appears above the Chrome steps | pass | n/a | n/a | n/a | n/a |  |
| AB-10 an accepted prompt shows the installed state | State transition (prompt accepted) | Prompt() called once, then the installed state: heading ¡Todo listo! | pass | n/a | n/a | n/a | n/a |  |
| AB-11 a dismissed prompt removes the button and keeps the Chrome steps | State transition (prompt dismissed) | Button disappears, Chrome steps stay on screen | pass | n/a | n/a | n/a | n/a |  |
| AB-12 a prompt the browser refuses leaves no error, no button and the Chrome steps | Error guessing (browser refuses the prompt) | No crash, no error text, Chrome steps stay, button gone | pass | n/a | n/a | n/a | n/a |  |
| AB-13 the appinstalled event switches the page to the installed state without a reload | State transition (appinstalled event) | Page switches to ¡Todo listo! without a reload | pass | n/a | n/a | n/a | n/a |  |
| AB-14 opened as the installed app from Mi cuenta, the install help says all set with the way back | State transition (already installed, Android) | ¡Todo listo!, link Volver a Mi cuenta to /account, no green header | pass | n/a | n/a | n/a | n/a |  |
| AB-15 installed on iPhone right after registration, Continuar leads to Check In | State transition (already installed, iPhone, after registration) | ¡Todo listo! with green header, link Continuar goes to /check-in | n/a | pass | n/a | n/a | n/a |  |
| AB-16 the account language English shows the install help and the installed state in English | Equivalence partition (English, account language) | Texts from en.ts: Keep the app at hand, Open this page in Safari. | pass | pass | n/a | n/a | n/a |  |
| AB-17 the device language English before sign in translates the install help after registration | Equivalence partition (English, device language before sign-in) | Title Install the app, description Reach the gym from your home screen. | pass | pass | n/a | n/a | n/a |  |
| AB-18 the manifest, the icons and the worker are linked and served | Equivalence partition (manifest and icons) | Manifest name Gym RUM, display: standalone, start_url: /account | pass | n/a | n/a | n/a | n/a |  |
| AB-19 launched as the installed app and signed in, Mi cuenta shows the profile and the install row that leads to all set | State transition (launch as installed, signed in) | Mi cuenta with profile | pass | pass | n/a | n/a | n/a |  |
| AB-20 launched as the installed app with the session ended, Mi cuenta sends to sign in with no error | State transition (launch as installed, session ended) | Redirect to /sign-in (Iniciar sesión), no error banner | pass | pass | n/a | n/a | n/a |  |
| AB-21 a path outside the User routes opens the health page | Invalid input (path outside the User routes) | The health page shows "API: conectada" | pass | n/a | n/a | n/a | n/a |  |
| AB-22 the worker takes control, caches the app once and never the API | Equivalence partition (worker takes control) | The worker takes control, caches the app once and never the API | pass | n/a | n/a | n/a | n/a |  |
| AB-23 Welcome opens offline in its collapsed state | State transition (open offline, Welcome) | Heading Bienvenido (collapsed sheet) with hint Toca o desliza para continuar | pass | pass | n/a | n/a | n/a |  |
| AB-24 Welcome offline disables both actions and enables them back online | State transition (Welcome offline, expanded, then reconnect) | Heading Bienvenido al gimnasio, banner Sin conexión | pass | pass | n/a | n/a | n/a |  |
| AB-25 the install help opens offline and its tabs work | State transition (open install help offline) | Heading Instalar app, tabs work, no network call needed | pass | pass | n/a | n/a | n/a |  |
| AB-26 sign in offline keeps what was typed and works again online | State transition (sign-in offline keeps typing) | Banner Sin conexión · Datos no actualizados, caption Conéctate para continuar | pass | pass | n/a | n/a | n/a |  |
| AB-27 Mi cuenta opened cold offline says nothing is saved and loads by itself on reconnect | State transition (Mi cuenta cold offline, nothing saved) | Banner Sin conexión, title Mi cuenta | pass | pass | n/a | n/a | n/a |  |
| AB-28 Mi cuenta going offline after loading keeps the data, blocks the settings actions and recovers | State transition (Mi cuenta goes offline after loading) | Banner Sin conexión | pass | pass | n/a | n/a | n/a |  |
| AB-29 the privacy notice saved before opens offline with its offline caption | State transition (privacy notice offline, saved before) | Heading Aviso de privacidad, notice card, caption Este aviso también está disponible sin conexión | pass | pass | n/a | n/a | n/a |  |
| AB-30 the privacy notice offline with nothing saved shows the draft frame | Boundary (privacy notice offline, nothing saved) | Draft frame with badge BORRADOR, no spinner forever, no crash | pass | pass | n/a | n/a | n/a |  |
| AB-31 Gimnasio and Check In offline say there is no connection | State transition (Gimnasio and Check In offline, owned by flows 4 and 5) | Gimnasio: Sin conexión, the last count kept | pass | pass | n/a | n/a | n/a |  |
| AB-32 the same shell opens the dashboard sign in offline and blocks the button | Cross-surface (same shell serves the dashboard) | Dashboard sign-in Iniciar sesión with notice Sin conexión / Conéctate a internet para iniciar sesión | n/a | n/a | pass | by hand | pass | Firefox checked by hand: Playwright cannot cut the service worker network there |
| AB-33 a real iPhone install keeps the Safari session | Manual only (real iPhone install) | Opens full screen, /install now shows ¡Todo listo! | n/a | manual | n/a | n/a | n/a | real iPhone only |
| AB-34 a real Android install opens offline from the home screen | Manual only (real Android install) | Prompt appears (Chrome fired the event), after install ¡Todo listo! | manual | n/a | n/a | n/a | n/a | real Android only |
| AB-35 a new build replaces the shell and removes the old cache | Needs-redeploy (new version replaces the shell) | A new build replaces the shell and removes the old cache | not run | not run | not run | not run | not run | needs two builds behind one proxy |

## 8. Staff accounts

Devices that ran: Android, iPhone, Desktop (Chrome), Firefox, Safari. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| SA-01 the Administrator signs in, the button shows the busy text and keeps focus | Equivalence partition (Administrator signs in) | Button reads Iniciando sesión… while busy and keeps focus | n/a | n/a | pass | pass | pass | WebKit does not focus a clicked button by design, so the focus check is skipped there |
| SA-02 Staff sign in without the Administration items | Equivalence partition (Staff signs in, role permissions) | Recepción de prueba · Staff, Sesiones activas visible, no Administración section | n/a | n/a | pass | pass | pass |  |
| SA-03 a wrong password shows the notice and keeps what was typed | Equivalence partition (wrong password) | Notice No pudimos iniciar sesión / Verifica tu correo y contraseña e intenta de nuevo | n/a | n/a | pass | pass | pass |  |
| SA-04 an unknown email gets the same answer as a wrong password | Equivalence partition (unknown email, no enumeration) | The same notice as SA-03, text for text | n/a | n/a | pass | pass | pass |  |
| SA-05 an invited account with no password yet gets the wrong-password notice | State transition (invited account has no password yet) | An invited account with no password yet gets the wrong-password notice | n/a | n/a | pass | pass | pass |  |
| SA-06 the email is trimmed and matched whatever its case | Equivalence partition (case and spaces) | The email is trimmed and matched whatever its case | n/a | n/a | pass | pass | pass |  |
| SA-07 empty fields are named, nothing is sent, focus goes to the first one with an error | Boundary values (empty fields) | Each empty field shows Este campo es obligatorio | n/a | n/a | pass | pass | pass |  |
| SA-08 255 characters reach the server, 256 are refused under the field | Boundary values (255 and 256 characters) | 255 characters reach the server, 256 are refused under the field | n/a | n/a | pass | pass | pass |  |
| SA-09 an email with no @ gets the wrong-password notice, not a validation error | Equivalence partition (not an email) | The server has no email rule on sign-in | n/a | n/a | pass | pass | pass |  |
| SA-10 a User account cannot sign in on the staff page | Equivalence partition (a User account on the staff page) | A User account cannot sign in on the staff page | n/a | n/a | pass | pass | pass |  |
| SA-11 a deactivated account with the right password gets its own notice and a blocked button | State transition (deactivated account signs in) | Notice Cuenta desactivada / No puedes iniciar sesión con esta cuenta | n/a | n/a | pass | pass | pass |  |
| SA-12 a deactivated account with a wrong password looks like any wrong password | State transition (deactivated, wrong password) | Generic SA-03 notice | n/a | n/a | pass | pass | pass |  |
| SA-13 nine failures do not lock the account, the tenth does | Boundary values (9 and 10 failures) | Nine failures do not lock the account, the tenth does | n/a | n/a | pass | pass | pass |  |
| SA-14 the eleventh attempt shows the wait, the button opens again after 60 seconds and the right password signs in | Boundary values (11th attempt after 10 failures) | Notice Demasiados intentos / Intenta de nuevo a las | n/a | n/a | pass | pass | pass |  |
| SA-15 the wait grows 1 minute, 5 minutes, 15 minutes, 1 hour and starts again after a day | State transition (wait grows 60, 300, 900, 3600 s) | Waits 1 min, 5 min, 15 min, then 1 h | n/a | n/a | pass | pass | pass |  |
| SA-16 ten failures on one account also lock another valid account from the same address | Equivalence partition (lock is per IP too) | Demasiados intentos as in SA-14 (IP counter) | n/a | n/a | pass | pass | pass |  |
| SA-17 without a connection the notice shows, the typed values stay and sign in works once online | Error guessing (no connection while signing in) | Notice Sin conexión / Conéctate a internet para iniciar sesión | n/a | n/a | pass | pass | pass |  |
| SA-18 a server error and a proxy page leave the person able to try again | Error guessing (server error and proxy down) | A server error and a proxy page leave the person able to try again | n/a | n/a | pass | pass | pass |  |
| SA-19 a lost CSRF cookie does not stop the sign-in | Error guessing (CSRF cookie lost) | A lost CSRF cookie does not stop the sign-in | n/a | n/a | pass | pass | pass |  |
| SA-20 the sign-in works with the keyboard alone and the busy button keeps focus | Equivalence partition (keyboard only) | Order as listed, busy button keeps focus | n/a | n/a | pass | pass | pass | WebKit does not focus a clicked button by design, so the focus check is skipped there |
| SA-21 a reload keeps the sign-in, sign out ends it for Back and reload too | State transition (reload keeps the sign-in, sign out ends it) | Header still visible after reload | n/a | n/a | pass | pass | pass |  |
| SA-22 signing out without a connection says so and keeps the sign-in | Error guessing (sign out without connection) | Notice No se pudo cerrar sesión / Revisa la conexión e intenta de nuevo. | n/a | n/a | pass | pass | pass |  |
| SA-23 signing out in one tab sends the other tab to Iniciar sesiÃ³n with no notice | State transition (sign out in another tab) | Tab 2 goes to Iniciar sesión with no notice | n/a | n/a | pass | pass | pass |  |
| SA-24 the same account stays signed in on two computers | State transition (same account on two computers) | The same account stays signed in on two computers | n/a | n/a | pass | pass | pass |  |
| SA-25 a staff sign-in and a User sign-in in one browser do not end each other | Cross-surface (Staff and User sessions in one browser) | Staff sign out does not end the member session | pass | n/a | n/a | n/a | n/a |  |
| SA-26 a deep link to the team screen asks for sign in first, then opens it at the same address | State transition (deep link, Administrator) | Iniciar sesión first, then Cuentas del staff at the same URL | n/a | n/a | pass | pass | pass |  |
| SA-27 a Staff account at the team address sees the empty dashboard and never asks for the list | Permissions (deep link, Staff) | Empty dashboard (hidden Gimnasio de pesas h1, no Cuentas del staff title) | n/a | n/a | pass | pass | pass |  |
| SA-28 a Staff sign-in ends after 2 hours idle, not before | Needs-clock (Staff idle 2 h, boundary 1 h 59 m 59 s and 2 h) | Under 2 h still signed | n/a | n/a | pass | pass | pass |  |
| SA-29 an Administrator sign-in ends after 20 minutes idle, not before | Needs-clock (Administrator idle 20 min) | An Administrator sign-in ends after 20 minutes idle, not before | n/a | n/a | pass | pass | pass |  |
| SA-30 the automatic check does not keep a sign-in alive, a real click does | Needs-clock (auto refresh does not keep it alive; real activity does) | The automatic check does not keep a sign-in alive, a real click does | n/a | n/a | pass | pass | pass |  |
| SA-31 the forgot link opens the recovery page and the secondary link goes back | Equivalence partition (open forgot page) | URL /staff/recuperar, h1 Recuperar contraseña, Escribe el correo de tu cuenta del equipo. | n/a | n/a | pass | pass | pass |  |
| SA-32 an existing account gets the reset mail with a working link | Equivalence partition (existing account gets the mail) | H1 Revisa tu correo, Si existe una cuenta del equipo con ese correo | n/a | n/a | pass | pass | pass |  |
| SA-33 unknown, deactivated and invited addresses get the same screen and no mail | Equivalence partition (no enumeration: unknown, deactivated, invited) | The same Revisa tu correo screen each time | n/a | n/a | pass | pass | pass |  |
| SA-34 an empty and a malformed email are named under the field | Boundary values (empty and malformed email) | Este campo es obligatorio | n/a | n/a | pass | pass | pass |  |
| SA-35 a second request within 60 seconds sends no second mail, after 60 seconds it does | Boundary values (second request within 60 s) | A second request within 60 seconds sends no second mail, after 60 seconds it does | n/a | n/a | pass | pass | pass |  |
| SA-36 the eleventh request in a minute says to wait | Boundary values (10 per minute per IP) | 11th: Notice with Demasiados intentos | n/a | n/a | pass | pass | pass |  |
| SA-37 a reset link used twice says it is expired or used | State transition (reset link used twice) | H1 Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-38 a tampered, missing or mismatched link parameter is expired or used | Invalid input (tampered, missing or mismatched parameters) | All show Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-39 a reset link works at 59 minutes and is expired at 61 | Boundary values (reset link age 59 and 61 minutes) | A reset link works at 59 minutes and is expired at 61 | n/a | n/a | pass | pass | pass |  |
| SA-40 a new request replaces the old link | State transition (a new request replaces the old link) | Link 1: Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-41 an account deactivated after the mail cannot use the link | State transition (account deactivated after the mail) | Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-42 a 9 character password is refused under the field, 10 unique characters are saved | Boundary values (password length 9 and 10) | A 9 character password is refused under the field, 10 unique characters are saved | n/a | n/a | pass | pass | pass |  |
| SA-43 a leaked password is refused when the leak service answers | Equivalence partition (leaked password) | A leaked password is refused when the leak service answers | n/a | n/a | pass | pass | pass |  |
| SA-44 a confirmation that differs, and two empty fields, are named under the right field | Equivalence partition (confirmation differs, both empty) | La confirmación no coincide | n/a | n/a | pass | pass | pass |  |
| SA-45 the password field keeps 255 characters and a 255 character password works | Boundary values (255 characters) | The field keeps 255 (maxLength) | n/a | n/a | pass | pass | pass |  |
| SA-46 a reset signs the account out everywhere | State transition (a reset ends other open sign-ins) | Context 1 goes to Iniciar sesión with no notice (unauthenticated) | n/a | n/a | pass | pass | pass |  |
| SA-47 after saving, the address has no token and Back does not reopen the link | State transition (after saving) | N-11 with Contraseña guardada / Inicia sesión con tu nueva contraseña | n/a | n/a | pass | pass | pass |  |
| SA-48 a link check that fails shows the error with a retry, for the reset and the invitation links | Error guessing (link check fails) | While waiting: Revisando el enlace… | n/a | n/a | pass | pass | pass |  |
| SA-49 without a connection the new password is not saved, the values stay and a retry works | Error guessing (offline while saving the new password) | Notice Sin conexión / Revisa la conexión e intenta de nuevo. | n/a | n/a | pass | pass | pass |  |
| SA-50 the eleventh save in a minute says to wait, for invitation and reset links | Boundary values (10 per minute on save) | 11th is 429, the page shows Demasiados intentos | n/a | n/a | pass | pass | pass |  |
| SA-51 a User reset link does not open the staff reset page | Invalid input (a User reset link used on the staff page) | Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-52 the invitation and reset links work in a phone browser, then the desktop signs in | Cross-device (email link opened on a phone) | Pages render without horizontal scroll, forms work | pass | pass | n/a | n/a | n/a |  |
| SA-53 the list shows the title, summary, columns, chips and note, active first | Equivalence partition (A-15 list) | H1 Cuentas del staff, Administra el acceso del equipo al gimnasio. | n/a | n/a | pass | pass | pass |  |
| SA-54 inviting a Staff person shows the banner, the Invitado row and the mail | Equivalence partition (invite Staff) | Inviting a Staff person shows the banner, the Invitado row and the mail | n/a | n/a | pass | pass | pass |  |
| SA-55 an invited Administrator becomes Activo and sees the Administration items | Equivalence partition (invite an Administrator) | Row chip Invitado then Activo with role Administrador | n/a | n/a | pass | pass | pass |  |
| SA-56 empty and malformed invite fields are named, the first one gets focus, the dialog stays open | Boundary values (empty and malformed fields) | Este campo es obligatorio | n/a | n/a | pass | pass | pass |  |
| SA-57 a 255 character name is invited, a 256 character name is refused by the API | Boundary values (name 255 and 256) | A 255 character name is invited, a 256 character name is refused by the API | n/a | n/a | pass | pass | pass |  |
| SA-58 an email already in use, in any case or deactivated, is refused with the in-use view and no mail | Equivalence partition (email already used) | An email already in use, in any case or deactivated | n/a | n/a | pass | pass | pass |  |
| SA-59 HTML in a name is shown as text and runs nothing | Error guessing (HTML in the name) | Row and banner show the text literally, no dialog or script runs | n/a | n/a | pass | pass | pass |  |
| SA-60 the invite dialog keeps focus inside, closes with Esc and gives focus back | Equivalence partition (Esc, Cancelar, focus) | Focus never leaves the dialog | n/a | n/a | pass | pass | pass | Bug 14: Safari gave focus to the page instead of the opening button; fixed in StaffTeam |
| SA-61 the eleventh invitation in a minute says to wait inside the dialog | Boundary values (10 invitations per minute) | 11th: notice inside the dialog Demasiados intentos | n/a | n/a | pass | pass | pass |  |
| SA-62 the invitation page shows who is invited and creates the password | Equivalence partition (first sign-in from the invite link) | H1 Crear tu contraseña, Completa tu acceso al equipo del gimnasio. | n/a | n/a | pass | pass | pass |  |
| SA-63 an invitation link used twice says it is expired or used | State transition (invite link used twice) | H1 Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-64 an invitation link works with a minute left and is expired a second after | Boundary values (invitation link age) | An invitation link works with a minute left and is expired a second after | n/a | n/a | pass | pass | pass |  |
| SA-65 a missing or tampered invitation token is expired or used | Invalid input (tampered or missing token) | Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-66 the invitation page checks the password rules like the reset page | Invalid input (invite password rules) | The invitation page checks the password rules like the reset page | n/a | n/a | pass | pass | pass |  |
| SA-67 resending replaces the old link | State transition (resend invitation, old link dies) | Resending replaces the old link | n/a | n/a | pass | pass | pass |  |
| SA-68 resending for an account that already accepted says it is no longer pending and reloads the list | State transition (stale resend: already active) | Notice Esta cuenta ya no está pendiente de invitación | n/a | n/a | pass | pass | pass |  |
| SA-69 each kind of row offers its own actions, named with the person | Permissions (which rows offer which actions) | Active other: Cambiar rol, Desactivar | n/a | n/a | pass | pass | pass |  |
| SA-70 changing Staff to Administrador shows the dialog, the banner, the row and the audit entry | Equivalence partition (change role Staff to Administrador) | Dialog Cambiar rol, name, email, Rol actual: Staff, Nuevo rol with Administrador preselected | n/a | n/a | pass | pass | pass |  |
| SA-71 changing Administrador to Staff takes the Administration items away on the next load | Equivalence partition (change role Administrador to Staff) | Rol actual: Administrador, banner text with Staff, row Staff | n/a | n/a | pass | pass | pass |  |
| SA-72 choosing the role the person already has closes the dialog and changes nothing | Boundary values (same role chosen) | Dialog closes, no request, no Rol cambiado, no audit entry | n/a | n/a | pass | pass | pass |  |
| SA-73 nobody changes their own role, in the dialog or through the API | Permissions (own role) | Dialog No puedes cambiar tu propio rol / Debes conservar tu rol Administrador | n/a | n/a | pass | pass | pass |  |
| SA-74 a promotion shows on the other computer after a reload | State transition (role changes while the person is signed in: promotion) | Header changes to · Administrador, Administración section and Cuentas del staff link appear | n/a | n/a | pass | pass | pass |  |
| SA-75 a demotion while on the team screen leaves the Administrator pages on the next action | State transition (role downgrade while signed in) | The API answers 403 forbidden | n/a | n/a | pass | pass | pass |  |
| SA-76 after a demotion the idle limit is the Staff limit | Needs-clock (idle limit follows the new role) | Still signed in (Staff limit 2 h now) | n/a | n/a | pass | pass | pass |  |
| SA-77 two Administrators demoting each other at once: exactly one call wins | Concurrency (two Administrators act on each other) | Exactly one call succeeds | n/a | n/a | pass | pass | pass |  |
| SA-78 saving a role change for an account deactivated meanwhile says it changed and refreshes the list | State transition (stale dialog) | Inside the dialog Esta cuenta cambió mientras la veías | n/a | n/a | pass | pass | pass |  |
| SA-79 deactivating asks first, then marks the row, tells the reader and writes the audit entry | Equivalence partition (deactivate) | Deactivating asks first, then marks the row, tells the reader and writes the audit entry | n/a | n/a | pass | pass | pass |  |
| SA-80 cancelling the deactivation, with the button and with Esc, changes nothing and returns focus | Equivalence partition (cancel) | Cancelling the deactivation, with the button and with Esc, changes nothing and returns focus | n/a | n/a | pass | pass | pass | Bug 14: Safari gave focus to the page instead of the opening button; fixed in StaffTeam |
| SA-81 a deactivation ends the open sign-in on the other computer with its own notice | State transition (deactivated while signed in elsewhere) | Context 2 goes to Iniciar sesión with Cuenta desactivada notice and a blocked button | n/a | n/a | pass | pass | pass |  |
| SA-82 after Reactivar the old sign-in stays dead and a new sign-in works | State transition (reactivate; old sign-in stays dead) | After Reactivar the old sign-in stays dead and a new sign-in works | n/a | n/a | pass | pass | pass |  |
| SA-83 deactivating an invited account withdraws the invitation, Reactivar brings it back | State transition (withdraw an invitation) | After deactivation: row Desactivado, link shows Enlace vencido o usado | n/a | n/a | pass | pass | pass |  |
| SA-84 nobody deactivates their own account | Permissions (own account) | No button on the own row | n/a | n/a | pass | pass | pass |  |
| SA-85 confirming a deactivation that another Administrator already made says it changed and writes one audit entry | State transition (stale deactivate / double action) | Context 2: notice Esta cuenta cambió mientras la veías | n/a | n/a | pass | pass | pass |  |
| SA-86 a Staff account is refused every Administrator route | Permissions (Staff calls every Administrator route) | Each: 403 with code forbidden (No tienes permiso para hacer esto.) | n/a | n/a | pass | pass | pass |  |
| SA-87 with nobody signed in every Administrator route answers 401 | Permissions (nobody signed in) | With nobody signed in every Administrator route answers 401 | n/a | n/a | pass | pass | pass |  |
| SA-88 a User session is not accepted on the staff routes | Permissions (a User session on staff routes) | A User session is not accepted on the staff routes | pass | n/a | n/a | n/a | n/a |  |
| SA-89 the list shows loading, an error with a retry, and the offline state | State transition (list loading, error, offline) | Cargando cuentas… / Espera un momento mientras se consulta el equipo | n/a | n/a | pass | pass | pass |  |
| SA-90 a server error on deactivate stays inside the dialog and a retry works | Error guessing (action fails with a server error) | Notice inside the dialog Algo salió mal de nuestro lado | n/a | n/a | pass | pass | pass |  |
| SA-91 the menu marks the team screen only there, Back and Forward move between screens, reload stays | Equivalence partition (browser Back and the menu) | Menu item has aria-current=page on the team screen only | n/a | n/a | pass | pass | pass |  |
| SA-92 an account with English as its language sees the dashboard in English, N-11 stays Spanish | Equivalence partition (English dashboard) | After sign-in: Staff accounts, Gym team, Active, Sign out, role Administrator | n/a | n/a | pass | pass | pass |  |
| SA-93 the first Administrator command refuses when an active Administrator exists | Equivalence partition (first Administrator command) | Exit code 1, An active Administrator already exists | n/a | n/a | pass | pass | pass |  |
| SA-94 a deactivated desk account cannot check a member out and the Gym ID stays active | Cross-device (a deactivated desk account cannot check a member out) | A deactivated desk account cannot check a member out and the Gym ID stays active | pass | pass | n/a | n/a | n/a |  |
| SA-95 Note only | Cross-device (staff action that reaches the phone: none today) | Note only: staff changes never touch phone sessions | n/a | n/a | n/a | n/a | n/a | note only |

## 9. Terms and athlete roster

Devices that ran: Android, iPhone, Desktop (Chrome), Firefox, Safari. Run of 2026-11-09, branch `152-flow-e2e-tests`.

| Path | Technique | Expected | Android | iPhone | Desktop (Chrome) | Firefox | Safari | Bug |
|---|---|---|---|---|---|---|---|---|
| TR-01 the term chip names the months and year of TÃ©rmino actual next to Acceso del equipo | Equivalence partition (term chip, one year) | Chip names the months and year of Término actual | n/a | n/a | pass | pass | pass |  |
| TR-02 a term that crosses a year names both years in the chip | Boundary values (term crosses a year) | Chip names both years: Octubre 2026 - febrero 2027 style | n/a | n/a | pass | pass | pass |  |
| TR-03 with no term today the chip is replaced by the Sin tÃ©rmino activo notice and the team list still works | State transition (no term today) | Chip Sin término activo, h2 No hay un término activo hoy | n/a | n/a | pass | pass | pass |  |
| TR-04 when the term has ended, the dashboard shows the notice and the phone refuses the member | Cross-device (term ended, dashboard and phone) | Mi cuenta: Sin autorización activa, badge Miembro, row Soy atleta pill | pass | pass | n/a | n/a | n/a |  |
| TR-05 on the last day of a term the chip and the phone still pass; one day later both flip | Boundary values (last day of a term) | Chip still shows the term | pass | pass | n/a | n/a | n/a |  |
| TR-06 when a new term starts today the chip shows it and the phone member has no authorization in it | State transition (a new term starts today) | A-15 chip shows the months of Próximo término | pass | pass | n/a | n/a | n/a |  |
| TR-07 a 50 character term name fits the Acceso vigente caption; 51 characters are refused by the database | Boundary values (term name on the phone) | 50 characters fit the caption; 51 are refused | pass | n/a | n/a | n/a | n/a |  |
| TR-08 the database refuses overlapping terms and a start after the end, and accepts adjacent, gap and one-day terms | Boundary values (overlap rule in the database, no screen) | Overlap, inside, identical: exception from academic_terms_no_overlap (SQLSTATE 23P01) | pass | n/a | n/a | n/a | n/a |  |
| TR-09 the database refuses a repeated student number, even a removed one, and a number over 20 characters | Boundary values (repeated student number in the database, no screen) | Duplicates fail with unique violation 23505 | pass | n/a | n/a | n/a | n/a |  |
| TR-10 Staff see Roster de atletas only; an Administrator also sees TÃ©rminos and Gestionar atletas | Permissions (menu: Staff versus Administrator) | Staff: Roster de atletas in the Staff section, no Términos, no Gestionar atletas | n/a | n/a | pass | pass | pass |  |
| TR-11 the TÃ©rminos, Gestionar atletas and Roster de atletas items go nowhere and their API routes answer 404 | Invalid input (menu items without a screen) | Items are plain text: no navigation, URL unchanged, no request | n/a | n/a | pass | pass | pass |  |
| TR-12 the lookup answers on the roster, not on the roster, claimed and wrong length | Cross-device (athlete lookup, roster states) | On the roster: no error. Not on the roster: "Revisa tu número" | pass | pass | n/a | n/a | n/a |  |
| TR-13 a removed roster record answers like a number that is not on the roster | Equivalence partition (removed roster record on the phone) | Answers like a number that is not on the roster | pass | pass | n/a | n/a | n/a |  |
| TR-14 a withdrawn athlete sees no active access and the athlete refusal on Check In | State transition (athlete withdrawn, end state from the seed) | Mi cuenta: Sin autorización activa, badge Atleta | pass | pass | n/a | n/a | n/a |  |
| TR-15 an athlete withdrawn while signed in loses the access caption within one refetch and is refused on Check In | Cross-device (withdraw while the athlete is signed in) | Caption changes from Acceso vigente · Término actual to Sin autorización activa | pass | n/a | n/a | n/a | n/a |  |
| TR-16 a withdrawn athlete keeps the open visit until it ends, then is refused on the next Check In | Cross-device (withdraw with an open visit) | The open visit stays; the next Check In is refused | pass | pass | n/a | n/a | n/a |  |
| TR-17 a reinstated athlete gets the access caption back and passes the authorization on Check In | State transition (reinstate end state) | Caption Acceso vigente · Término actual | pass | pass | n/a | n/a | n/a |  |
| TR-18 the database refuses to reactivate an authorization when the athlete has another active one in the term | Boundary values (reinstate collides with another active authorization) | Database refuses (unique authorizations_one_active_per_user_and_term, SQLSTATE 23505) | pass | n/a | n/a | n/a | n/a |  |
| TR-19 an authorization of an ended term gives Sin autorizaciÃ³n activa and the member refusal | Equivalence partition (authorization of an ended term) | Mi cuenta: Sin autorización activa, badge Miembro | pass | pass | n/a | n/a | n/a |  |
| TR-20 an account that never had an authorization has no badge, the Soy atleta pill and the member refusal | Equivalence partition (account that never had an authorization) | Sin autorización activa, no type badge, the pill Soy atleta | pass | pass | n/a | n/a | n/a |  |
| TR-21 a visit that began on the last evening of a term closes at the term end and leaves the occupancy | Cross-device (a visit ends at the end of the term) | The visit closes at the term end | pass | n/a | n/a | n/a | n/a |  |

## Visual checks

Measured in the browser (sizes and positions), never read from a screenshot. Test file: `frontend/e2e-paths/visual.spec.ts`. Rerun after the fixes: 37 passed, 0 failed.

| Check | Issue | Result | Fix |
|---|---|---|---|
| V-01 the Miembro pill keeps equal space on both sides | #17 | Figma question, answered by the team (pill padding) | in the decisions batch |
| V-02 the verified badge sits next to a wrapped name | #17 | pass | 9adb871 |
| V-03 the navigation does not cut content above the pill or hide the last card | #17 | pass | 9adb871 |
| V-04 N-07 shows only the loading block while the link is checked | #15 | pass | 105ff60 |
| V-05 N-02 wrong credentials outline both fields with inline text, no boxed notice | #15 | pass | 105ff60 |

Bug reports: [Discussion #158](https://github.com/Th3-Minorities/natatorio-gym-app/discussions/158).

## Rerunning the path tests

Before running the paths, rebuild and restart the proxy for the selected `KIM_PROJECT` from the repo root (add `-f` for the `KIM_TEST_NET` file when you use one); the proxy image tag is shared between stacks:

```powershell
docker compose -p <project> build proxy
docker compose -p <project> up -d proxy
```

From `frontend/`, run `npm run test:e2e:paths` against an isolated seeded stack, with Docker on `PATH` and `CI` unset. Set `KIM_PROJECT` and `APP_PORT`; optionally set `KIM_WORKTREE` for another checkout, `KIM_TEST_NET` and `TEST_SUBNET` for a network override, and `E2E_BASE_URL` for a different proxy URL. Install Playwright Chromium, Firefox and WebKit plus Python with Pillow for registration fixtures. Add Playwright arguments after `--` to select a file or project.
