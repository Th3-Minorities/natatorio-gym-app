import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiError } from '../api/client'
import { I18nProvider } from '../i18n'
import { StaffSignIn } from '../staff/StaffSignIn'
import '../styles/base.css'

// Development only: entry of signin-preview.html, N-11 with a fake sign-in, to compare each state with Figma.
// ?state= picks the state: normal (nothing pressed), timeout (after a sign-in expired, nothing pressed),
// signing, wrong, wait, offline, deactivated, ok. For the states after a press, the page fills both fields
// and presses the button by itself.
// ?lang=en shows English.
const params = new URLSearchParams(window.location.search)
const state = params.get('state') ?? 'normal'

async function fakeSignIn(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 600))
  switch (state) {
    case 'signing':
      return new Promise(() => {})
    case 'wait':
      throw new ApiError('too_many_requests', 429, undefined, 300)
    case 'offline':
      throw new ApiError('offline', 0)
    case 'deactivated':
      throw new ApiError('staff_account_deactivated', 403)
    case 'ok':
      window.alert('Signed in (fake)')
      return
    default:
      throw new ApiError('staff_credentials_invalid', 422)
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider locale={params.get('lang') ?? undefined}>
      <StaffSignIn onSignIn={fakeSignIn} startWith={state === 'timeout' ? 'timeout' : null} />
    </I18nProvider>
  </StrictMode>,
)

/** Types into a field the way a person would, so React sees the change. */
function type(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector)
  if (!input) return
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

if (state !== 'normal' && state !== 'timeout') {
  setTimeout(() => {
    type('input[type=email]', 'mariel.velez@uprm.example.edu')
    type('input[type=password]', 'una contraseña')
    document.querySelector<HTMLButtonElement>('button[type=submit]')?.click()
  }, 300)
}
