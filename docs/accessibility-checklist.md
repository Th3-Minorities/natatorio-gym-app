# Manual accessibility checklist

Manual test evidence for [issue #82](https://github.com/Th3-Minorities/natatorio-gym-app/issues/82). One row per screen or distinct state. **Partial** means only the state described in the notes was tested.

**Environment.** November 8, 2026: Codex in-app browser on macOS against the development tunnel, using seeded test accounts. November 10, 2026: every row was checked again with Playwright against a local stack built from `main`, with seeded accounts and test records made for each state. User app screens ran on the iPhone 13 emulation (WebKit) for layout and announcements, and on Chromium at the same size for the keyboard pass, because WebKit skips links on Tab by default. Dashboard screens ran on Desktop Chrome. The 200% column uses Desktop Chrome at 200% page zoom (a 756 × 383 CSS px viewport), the same method as November 8, 2026. The 320 px column uses 320 × 693 px for the user app and 320 × 640 px for the dashboard; the two focus-under-the-bar rows were rechecked by a scripted test at 320 × 568 px on Pixel 7 and iPhone 13 (RG-03). The team ran VoiceOver on iPhone and NVDA on Windows on all screens on November 10, 2026.

| Screen / route | Keyboard and visible focus | 200% zoom | 320 px | VoiceOver (iPhone) | NVDA (Windows) | Check In announcement | Offline announcement | Notes / evidence |
|---|---|---|---|---|---|---|---|---|
| Welcome `/welcome` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Tab and Enter open the expanded view. Its heading receives focus and Tab reaches both entry links and the language controls. Offline shows "Sin conexión" in a status region. |
| Registration privacy notice `/register` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Continued with the keyboard from the draft notice. |
| Registration number entry `/register/identify` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Back, number field, Continue and Sign in receive visible focus in order. Offline, the form says to connect in a status region. |
| Registration, invalid authorization number | Pass | Pass | Pass | Pass | Pass | N/A | Pass | `AB12C3` shows the receipt-number error (N03-02). Heading receives focus and the error is in a status region. |
| Registration, student not on roster | Pass | Pass | Pass | Pass | Pass | N/A | Pass | `999999999` shows N03-03. The error is in a status region. Activating receipt help returns to number entry with an inline receipt example. |
| Registration, athlete record already claimed | Pass | Pass | Pass | Pass | Pass | N/A | Pass | The seeded claimed number shows N03-11 with Sign in and Change number. The error is in a status region. |
| Registration, unclaimed athlete | Pass | Pass | Pass | Pass | Pass | N/A | Pass | A fresh roster number shows "Revisa tu correo" with the masked address in an alert region and a disabled resend countdown. |
| Create password `/register/password` | Pass | Pass | Pass | Pass | Pass | N/A | N/A | Reached with `PRUEBA1`. Fields, reveal buttons and Continue take visible focus. This step sends nothing, so it shows no offline notice. |
| User sign-in `/sign-in` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Tab reaches fields, reveal button, recovery link and submit. Enter signs in with the seeded account. |
| User password recovery `/recover-password` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Email, Send link and return link take visible focus. |
| New password `/reset-password` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Opened with a valid reset link. Both fields, reveal buttons, Save and the return link take visible focus. |
| My account `/account` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Account links and all three tabs show focus. At 320 px a scripted test focuses Privacy and Settings and checks they sit above the bottom bar (RG-03). |
| Settings `/account/settings` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Tab reaches language, sign-out, account deletion and navigation. |
| Account privacy `/account/privacy` | Pass | Pass | Pass | Pass | Pass | N/A | N/A | Draft notice loads with a level-two heading. Back and the three tabs take visible focus. |
| Delete account `/account/delete` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Enter opens the confirmation, which initially focuses Cancel. Escape restores focus to the opening button. |
| Install help `/install` | Pass | Pass | Pass | Pass | Pass | N/A | N/A | ArrowLeft selects iPhone from Android, so only the selected tab is a Tab stop. The page is static help with no offline notice. |
| Gym `/gym` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Occupancy loads and the three tabs take visible focus. Headings distinguish occupancy, the equipment guide and individual machines. |
| Check-in, expired or no active authorization `/check-in` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | The expired-payment account still shows the enabled hold button. Holding it shows "Tu acceso no está vigente", read from the status region. |
| Check-in, ended visit `/check-in` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | After a desk check-out. At 320 × 568 px on Pixel 7 and iPhone 13, a scripted test focuses Continue and checks it sits above the bottom bar (RG-03, passed November 10, 2026). |
| Check-in success `/check-in` | Pass | Pass | Pass | Pass | Pass | Pass | Pass | Holding the button with Space announces "Registrando entrada" and then "¡Tu entrada quedó registrada!" in the status region. |
| Gym ID card `/check-in` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Reopened with an open visit: "Tu entrada está registrada" with name, type, entry time and duration. |
| Athlete registration from the roster email link `/register/athlete` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | The emailed link opens the privacy notice, then the password step greets the athlete by roster name. |
| Staff sign-in `/staff` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Visible focus on fields, submit and recovery. Admin and reception credentials sign in. Submitting offline shows "Sin conexión" in an alert region. |
| Staff password recovery `/staff/recuperar` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Visible focus on email, send and return link. Submitting offline shows "Sin conexión" in an alert region. |
| Staff invitation and reset `/staff/invitacion`, `/staff/restablecer` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Opened with valid links. Both password fields and the submit button take visible focus. Submitting offline shows "Sin conexión" in an alert region. |
| Staff dashboard `/staff` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Skip link, menu and sign-out take visible focus in both roles, then the main content. Admin also sees the Administración links. |
| Staff S-01 active sessions and occupancy `/staff` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Checked as Staff and as Administrator with open visits. Offline, the occupancy card says "Sin conexión, Datos no actuales" in a status region. |
| Staff sessions list (on S-01) | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Tab reaches the name search, the table scrolling region, each name link and each Marcar salida button. At 200% and 320 px the table scrolls inside its own region without page overflow. |
| Staff S-02 person and session `/staff/sesiones/{id}` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Marcar salida, Terminar antes, Anular and the photo action take visible focus. Offline shows "Sin conexión. Datos actualizados a las …" in a status region. |
| Staff S-02 Marcar salida confirmation | Pass | Pass | Pass | Pass | Pass | N/A | N/A | The dialog opens with focus on "Sí, marcar salida" and Tab stays between its two buttons. After confirming, "Se marcó la salida." is read from the status region. |
| Staff S-03 find a person `/staff/buscar` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Search field, Buscar and Ver roster take visible focus. Searching offline shows "Sin conexión" in an alert region. |
| Staff S-03 assisted Check In | Pass | Pass | Pass | Pass | Pass | Pass | N/A | Photo check, confirm dialog and Confirmar Check in work with the keyboard. After a successful entry, S-01 opens and "Check in registrado" is read from a status region (RG-01 passed 3 of 3). |
| Staff S-05 roster `/staff/roster` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Search and each Check in button take visible focus. The table scrolls inside its own region. Offline shows "Sin conexión" with the last update time in a status region. |
| Staff accounts `/staff/equipo` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Tab reaches the skip link, Invite, the table scrolling region and every row action. At 200% and 320 px the table scrolls inside its own region without page overflow. Offline shows "Sin conexión" in a status region. |
| Invite Staff dialog | Pass | Pass | Pass | Pass | Pass | N/A | N/A | Enter opens the dialog and focuses the first field. The role choice is one Tab stop. Escape closes it and returns focus to Invite. |
| Administrator A-04 terms `/staff/terminos` | Pass | Pass | Pass | Pass | Pass | N/A | N/A | Crear término, Ver términos pasados and each Editar take visible focus. The screen shows no offline notice. |
| Administrator A-04 term dialog | Pass | Pass | Pass | Pass | Pass | N/A | N/A | Crear término opens the dialog on the name field. Tab moves through the date parts, Guardar término and Cancelar. At 200% the dialog scrolls and Guardar término is visible when focused. |
| Administrator A-05 roster `/staff/atletas` | Pass | Pass | Pass | Pass | Pass | N/A | Pass | Descargar roster, Añadir atleta, search, filters and each row's Editar and Retirar take visible focus. Offline shows "Sin conexión" in a status region. |
| Administrator A-05 withdraw dialog | Pass | Pass | Pass | Pass | Pass | N/A | N/A | Retirar opens the dialog with focus on Retirar atleta. Tab stays between its two buttons and Escape closes it. |
| Administrator A-05 download dialog | Pass | Pass | Pass | Pass | Pass | N/A | N/A | The format buttons, Descargar and Cancelar take visible focus. After the download, "Se descargó el roster." is read from a status region. |

## Findings

1. **Check-in shows an enabled action for accounts without active authorization.** Still happens in part on `main`. Sign in as the expired-payment account and open Check-in: "Mantén presionado para entrar" is enabled. Holding it now ends with "Tu acceso no está vigente" and a "Revisar mi acceso" link to My account, read from the status region, so the server refusal is verified. The button itself stays enabled.
2. **Unclaimed athlete lookup gives no visible confirmation.** Fixed on `main`. Submitting an unclaimed roster number now shows "Revisa tu correo", the masked institutional address in an alert region and a disabled resend countdown, and the email link arrives.
3. **On S-03 the identity check was possible before the photo loaded.** Fixed by holding the check until the photo loads (frame 4288:1354), in main through #177.

## Screen reader preparation

Chrome's accessibility tree exposes the Welcome and Sign in headings at level one, labels both sign-in fields, and names the main navigation on My account and Check-in. Check-in exposes the current tab with `aria-current="page"` and a status region.

## Pending evidence

- Merge commit 7b3dff1 (finding 3) and re-check S-03 on `main`.
- Record new screens as they are built.
