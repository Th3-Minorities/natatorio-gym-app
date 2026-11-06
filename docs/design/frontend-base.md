# Frontend base

The pieces every screen of the PWA shares: design values, texts in Spanish and English, dates, buttons, fields, states and the dashboard shell. Set up in GitHub issue #97. The User app (#14) builds on the same pieces. Requirements: REQ-NF-10, REQ-NF-13, REQ-NF-14, REQ-NF-33, REQ-NF-37, REQ-NF-38.

## 1. Rules

- The Figma file [MOCKUPS-GYM](https://www.figma.com/design/nNbbrnfaV1Tm7dnqKhNomi/MOCKUPS-GYM) decides how things look. Build only what it draws. [Wireframes](wireframes.md) links each screen to its frame.
- When Figma would change the backend, the backend comes first. Ask the team.
- Every text goes in `src/i18n/es.ts` and `src/i18n/en.ts`, never in a component.
- No library for routing, translations or styles (context.md, "Frontend"). Styles are plain CSS that use the design values below.

## 2. Folders

All paths are inside `frontend/`.

| Folder | What it holds |
|---|---|
| `src/styles/` | `tokens.css` (design values), `base.css` (font, page colors, keyboard focus) |
| `src/i18n/` | The texts, `I18nProvider`, `useMessages()`, `errorMessage()` |
| `src/format/` | Dates and times |
| `src/components/` | Button, text field, notice and the four states |
| `src/dashboard/` | The dashboard shell with its sidebar |
| `src/dev/`, `*-preview.html` | Preview pages for checking by eye. Development only |

## 3. Design values

`src/styles/tokens.css` holds the Figma colors, spacing and font as CSS variables: `var(--primary)`, `var(--spacing-16)`, `var(--font-sans)`. Use them instead of writing a color or a size again.

`tokens.test.ts` checks each value against Figma and checks the contrast of each text and background pair (WCAG 2.2 AA: 4.5:1 for text, 3:1 for icons). When you add a value, add its contrast pair there too.

Two values are not Figma variables. `--hero-raised` is the Administration group in the sidebar, drawn as a plain color. `--sage-on-raised` is the "Administración" label on it: Figma's sage there gives 4.00:1, so it is 16% lighter to reach 4.5:1.

Not fixed yet: the border of a text field is 1.37:1 on its background, below the 3:1 that WCAG 1.4.11 asks for. It follows Figma until the design changes.

## 4. Texts and language

```tsx
const texts = useMessages()
return <p>{texts.states.loading}</p>
```

- Add each new text to `es.ts` and `en.ts` under the same key. TypeScript and `i18n.test.tsx` both fail when the two files differ.
- `<I18nProvider locale={account.locale}>` gives the texts of the account language and sets `<html lang>`. Without a signed-in account it is Spanish (E-103).
- The API answers errors in the account language too, from `backend/lang` (SelectAccountLocale).
- To show an API error, use the code, never the server's message: `errorMessage(texts, error.code, status)`. An unknown code gets the general text. A test reads `backend/lang/*/errors.php` and fails when a backend code has no text here.

## 5. Dates and times

```tsx
const dates = useDateFormat()
dates.dateTime(visit.started_at) // "5 nov 2026, 8:30 a. m." or "Hoy, 10:42 a. m."
dates.date(term.ends_on)          // "5 nov 2026"
dates.time(visit.started_at)      // "9:28 a. m."
```

The format follows Figma in each language (REQ-NF-38, E-152). English is `Nov 5, 2026, 8:30 AM` and `Today, 10:42 AM`. Every time is in Puerto Rico time, whatever the device says (REQ-NF-37). The API sends UTC, and these functions convert it.

## 6. Shared pieces

The text keys in these examples are made up. Each screen adds its own.

```tsx
import { Button, TextField, Notice, LoadingState, EmptyState, ErrorState, OfflineState } from '../components'

<TextField label={texts.signIn.email} type="email" error={emailError} />
<Button type="submit" size="large" fullWidth>{texts.signIn.submit}</Button>
<Button variant="secondary" onClick={close}>{texts.common.cancel}</Button>
<Notice title={texts.signIn.failedTitle}>{texts.signIn.failedText}</Notice>
<ErrorState onRetry={load} />
```

| Piece | Options | Figma |
|---|---|---|
| `Button` | `variant`: primary, secondary, link. `size="large"` (52px). `fullWidth` | N-11, A-15 |
| `TextField` | `label`, `error`, and any input option | N-11, A-08 "Motivo insuficiente" |
| `Notice` | `title`, text inside | N-11 wrong password |
| `LoadingState` | `detail` | A-08 "Cargando" |
| `EmptyState` | `lead`, `detail` | A-08 "Sin resultados" |
| `ErrorState` | `onRetry` | A-08 "Error al cargar" |
| `OfflineState` | `detail` | A-08 "Sin conexión" |

The pieces take care of accessibility themselves: the label is tied to its field, the error is read with the field, the notice and the error state are announced, and the loading state is a status. Figma draws buttons at different widths. The shared button uses 20px on each side, and a screen sets a fixed width when its frame has one.

## 7. Dashboard shell

```tsx
<DashboardShell
  account={{ name: account.name, role: account.role }}
  onSignOut={signOut}
  title={texts.activeSessions.title}
  description={texts.activeSessions.description}
  action={<Button>{texts.activeSessions.checkIn}</Button>}
>
  {/* the screen */}
</DashboardShell>
```

- Only Administrators see the Administration items (REQ-NF-10). The backend still checks the role on every action (REQ-F-52).
- Menu items are plain text until the issue that builds their screen turns them into links.
- The role shows as "Staff" or "Administración", which has no gender, because staff accounts do not store one.
- A "Saltar al contenido" link appears on the first Tab, so keyboard users can skip the menu (WCAG 2.4.1).
- The sign-in that supplies `account` and `onSignOut` is #16.

## 8. Checking by eye

Run `npm run dev` in `frontend/` and open:

- <http://localhost:5173/component-preview.html>: every shared piece and the dates, each labeled with its Figma frame
- <http://localhost:5173/dashboard-preview.html>: the shell as drawn in Figma. Add `?role=staff` for the Staff view.

Add `?lang=en` to either one for English. The production build leaves both pages out.

## 9. Not in this base

- The dashboard path and its routes. The path name is still open (E-124), and #16 adds the first route with the sign-in page.
- The User app layout, its navigation, the Install button and the service worker (#14).
