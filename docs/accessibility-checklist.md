# Manual accessibility checklist

Manual test evidence for [issue #82](https://github.com/Th3-Minorities/natatorio-gym-app/issues/82). One row per screen or distinct state. **Partial** means only the state described in the notes was tested.

**Environment.** November 8, 2026. Codex in-app browser on macOS against the development tunnel, using seeded test accounts. The 320 px column records the measured CSS viewport. The 200% pass used Chrome on macOS at actual page zoom, with a measured viewport of about 756 × 383 CSS px. All VoiceOver (iPhone) results were reported by the tester on November 8, 2026.

| Screen / route | Keyboard and visible focus | 200% zoom | 320 px | VoiceOver (iPhone) | NVDA (Windows) | Check In announcement | Offline announcement | Notes / evidence |
|---|---|---|---|---|---|---|---|---|
| Welcome `/welcome` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Tab and Enter open the expanded view. Its heading receives focus and Tab reaches both entry links and the language controls. |
| Registration privacy notice `/register` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Continued with the keyboard from the draft notice. |
| Registration number entry `/register/identify` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Back, number field, Continue and Sign in receive visible focus in order. |
| Registration, invalid authorization number | Pass | Pass | Pass | Pass | Pending | N/A | Pending | `AB12C3` shows the receipt-number error (N03-02). Heading receives focus and the error is in a status region. |
| Registration, student not on roster | Pass | Pass | Pass | Pass | Pending | N/A | Pending | `999999999` shows N03-03. The error is in a status region. Activating receipt help returns to number entry with an inline receipt example. |
| Registration, athlete record already claimed | Pass | Pass | Pass | Pass | Pending | N/A | Pending | `802210141` shows N03-11 with Sign in and Change number. The error is in a status region. |
| Registration, unclaimed athlete | Partial | Pending | Partial | Pass | Pending | N/A | Pending | Enter and click submit `802000001`, then return to the number form without visible feedback. Email delivery and link landing still need verification. |
| Create password `/register/password` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Both unused numbers reach this form. The first attempt with `10231d` showed a connection message and the retry succeeded. Fields, reveal buttons and Continue take visible focus. |
| User sign-in `/sign-in` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Tab reaches fields, reveal button, recovery link and submit. Enter signs in with the seeded account. |
| User password recovery `/recover-password` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Email, Send link and return link take visible focus. |
| New password `/reset-password` | Partial | Partial | Partial | Pass | Pending | N/A | Pending | Opened without a valid token. Full valid-link state and submit flow need a test link. At 200%, the invalid-link view fit and its actions were reachable. |
| My account `/account` | Pass | **Fail** | Pass | Pass | Pending | N/A | Pending | Account links and all three tabs show focus clear of the bottom bar. All five supplied user accounts signed in. At 200%, the bottom bar obscures Privacy and Settings when they receive focus. |
| Settings `/account/settings` | Pass | **Fail** | Pass | Pass | Pending | N/A | Pending | Tab reaches language, sign-out, account deletion and navigation. At 200%, the bottom bar obscures Sign out and Delete account when they receive focus. |
| Account privacy `/account/privacy` | Pass | Pass | Pass | Pass | Pending | N/A | N/A | Draft notice loads with a level-two heading. Back and the three tabs take visible focus. |
| Delete account `/account/delete` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Enter opens the confirmation, which initially focuses Cancel. Escape restores focus to the opening button. |
| Install help `/install` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | ArrowLeft selects iPhone from Android. Both instruction panels fit and the keyboard reaches the panel and navigation. |
| Gym `/gym` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Occupancy loads and the three tabs take visible focus. Headings distinguish occupancy, the equipment guide and individual machines. |
| Check-in, expired or no active authorization `/check-in` | Pass | Pass | Pass | Pass | Pending | Pending | Pending | Expired payment, canceled order, removed athlete and no-authorization fixtures all show the enabled hold button. Space began location lookup for the expired-payment fixture. |
| Check-in, ended visit `/check-in` | **Fail** | Pass | **Fail** | Pass | Pending | N/A | Pending | With the manual-grant fixture, Tab focuses Continue under the fixed bottom navigation at 320 × 703 CSS px. Continue remained clear of the bottom bar in the 200% desktop pass. |
| Staff sign-in `/staff` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Visible focus on fields, submit and recovery. Admin and reception credentials sign in. |
| Staff password recovery `/staff/recuperar` | Pass | Pass | Pass | Pass | Pending | N/A | Pending | Visible focus on email, send and return link. |
| Staff invitation and reset `/staff/invitacion`, `/staff/restablecer` | Partial | Partial | Partial | Pass | Pending | N/A | Pending | Expired-link views fit at 320 px and links take focus. Valid-link views need test links. The expired-link views also fit at 200%. |
| Staff dashboard `/staff` | Pass | Pass | Partial | Pass | Pending | N/A | N/A | Skip link and sign-out take visible focus in both roles. Admin also sees Staff accounts. Admin checked at 320 px, reception checked at 266 px. |
| Staff accounts `/staff/equipo` | Partial | Partial | Pass | Pass | Pending | N/A | N/A | Tested the skip link, Invite, table scrolling region and row actions. The page has no horizontal overflow at 320 px. At 200%, the table scrolled inside its own region without page overflow. A full keyboard pass through the row actions remains pending. |
| Invite Staff dialog | Pass | Pass | Pass | Pass | Pending | N/A | N/A | Enter opens the dialog and focuses the first field. Escape closes it and returns focus to Invite. |

## Findings

1. **Check-in focus is obscured by the bottom bar.** Sign in with the manual-grant fixture, open Check-in while the ended visit is displayed, set a 320 × 703 CSS px viewport and press Tab. Continue is focused at y=601–649 px, under navigation at y=595–685 px. The center of Continue hits the Check-in navigation icon.
2. **Check-in shows an enabled action for accounts without active authorization.** The expired payment, canceled order, removed athlete and no-authorization fixtures show “Sin autorización activa” on My account and “Mantén presionado para entrar” on Check-in. An attempt with the expired-payment fixture reached “Obteniendo ubicación.” The server outcome remains unverified.
3. **Unclaimed athlete lookup gives no visible confirmation.** Submit `802000001` from the unified number form. After loading, the form returns with the same number and an empty status region. Check the development inbox separately to determine whether the email was sent.

4. **At 200%, the bottom bar obscures focused account controls.** In Chrome, sign in with the expired-payment fixture, set page zoom to 200%, then Tab through My account and Settings. The bottom navigation covers the centers of Privacy and Settings in My account, and Sign out and Delete account in Settings.

## Screen reader preparation

Chrome's accessibility tree exposes the Welcome and Sign in headings at level one, labels both sign-in fields, and names the main navigation on My account and Check-in. Check-in exposes the current tab with `aria-current="page"` and a status region.

## Pending evidence

- Run NVDA on Windows. Listen for the successful Check In result and for the offline notice after disconnecting with the app open.
- Verify registration with the test athlete email link and valid password-recovery and Staff invitation links from the development inbox.
- Finish the partial and pending rows, including 200% checks for the remaining states and record remaining midterm screens as they are tested.
