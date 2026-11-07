import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { StaffSignIn } from './StaffSignIn'

// N-11 in Figma MOCKUPS-GYM: main frame 4039:3721; states signing in 4039:3798, wrong email or password 4039:3871,
// too many tries 4039:3942, no connection 4039:4018, deactivated 4039:4094.

const t = es.signIn

function renderSignIn(onSignIn = vi.fn(async () => {})) {
  render(<StaffSignIn onSignIn={onSignIn} />)
  return onSignIn
}

function fill(email = 'mariel.velez@uprm.example.edu', password = 'una contraseña') {
  fireEvent.change(screen.getByLabelText(t.email), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(t.password), { target: { value: password } })
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: t.submit }))
}

/** Signs in with an answer that never comes, to look at the busy state. */
function pending() {
  return vi.fn(() => new Promise<void>(() => {}))
}

function failing(error: ApiError) {
  return vi.fn(async () => {
    throw error
  })
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

afterEach(() => {
  vi.useRealTimers()
  setOnline(true)
})

describe('N-11', () => {
  it('has the texts, fields and link of the Figma frame', () => {
    renderSignIn()

    expect(screen.getByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(screen.getByText(t.description)).toBeInTheDocument()
    expect(screen.getByLabelText(t.email)).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText(t.email)).toHaveAttribute('placeholder', t.emailPlaceholder)
    expect(screen.getByLabelText(t.password)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(t.password)).toHaveAttribute('placeholder', t.passwordPlaceholder)
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled()
    expect(screen.getByRole('link', { name: t.forgot })).toHaveAttribute('href', '/staff/recuperar')
  })

  it('helps the browser fill and save the staff password', () => {
    renderSignIn()

    expect(screen.getByLabelText(t.email)).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText(t.password)).toHaveAttribute('autocomplete', 'current-password')
  })

  it('signs in with the email and password typed', async () => {
    const onSignIn = renderSignIn()
    fill('mariel.velez@uprm.example.edu', 'una contraseña')

    await act(async () => submit())

    expect(onSignIn).toHaveBeenCalledWith('mariel.velez@uprm.example.edu', 'una contraseña')
  })

  it('submits with Enter, like any form', async () => {
    const onSignIn = renderSignIn()
    fill()

    await act(async () => fireEvent.submit(screen.getByLabelText(t.email).closest('form')!))

    expect(onSignIn).toHaveBeenCalledOnce()
  })

  it('asks for both fields before sending anything', async () => {
    const onSignIn = renderSignIn()

    await act(async () => submit())

    expect(onSignIn).not.toHaveBeenCalled()
    expect(screen.getByLabelText(t.email)).toHaveAccessibleDescription(es.validation.required)
    expect(screen.getByLabelText(t.password)).toHaveAccessibleDescription(es.validation.required)
  })
})

describe('signing in (4039:3798)', () => {
  it('shows the busy button, keeps both fields and does not send twice', async () => {
    const onSignIn = renderSignIn(pending())
    fill()

    await act(async () => submit())
    const busy = screen.getByRole('button', { name: t.submitting })
    expect(busy).toBeDisabled()
    await act(async () => fireEvent.click(busy))

    expect(onSignIn).toHaveBeenCalledOnce()
    expect(screen.getByLabelText(t.email)).toHaveValue('mariel.velez@uprm.example.edu')
    expect(screen.getByLabelText(t.password)).toHaveValue('una contraseña')
  })
})

describe('wrong email or password (4039:3871)', () => {
  it('shows one notice for both cases and lets the person try again', async () => {
    renderSignIn(failing(new ApiError('staff_credentials_invalid', 422)))
    fill()

    await act(async () => submit())

    expect(screen.getByRole('alert')).toHaveTextContent(t.wrongTitle)
    expect(screen.getByRole('alert')).toHaveTextContent(t.wrongText)
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled()
    expect(screen.getByLabelText(t.email)).toHaveValue('mariel.velez@uprm.example.edu')
  })
})

describe('too many tries (4039:3942)', () => {
  it('says when to try again, in Puerto Rico time, and blocks the button until then', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-11-05T14:40:00Z')) // 10:40 a. m. in Puerto Rico
    renderSignIn(failing(new ApiError('too_many_requests', 429, undefined, 300)))
    fill()

    await act(async () => submit())

    expect(screen.getByRole('alert')).toHaveTextContent(t.waitTitle)
    // Exactly as in Figma: one period, even though the time already ends in "m.".
    expect(screen.getByRole('alert')).toHaveTextContent(/Intenta de nuevo a las 10:45 a\. m\.$/)
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled()

    await act(() => vi.advanceTimersByTimeAsync(300_000))
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled()
  })
})

describe('no connection (4039:4018)', () => {
  it('keeps what was typed and waits for the connection to come back', async () => {
    setOnline(false)
    renderSignIn(failing(new ApiError('offline', 0)))
    fill()

    await act(async () => submit())

    expect(screen.getByRole('alert')).toHaveTextContent(t.offlineTitle)
    expect(screen.getByRole('alert')).toHaveTextContent(t.offlineText)
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled()
    expect(screen.getByLabelText(t.password)).toHaveValue('una contraseña')

    setOnline(true)
    await act(async () => window.dispatchEvent(new Event('online')))
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled()
  })

  it('lets the person try again when the browser is online but the server did not answer', async () => {
    renderSignIn(failing(new ApiError('offline', 502)))
    fill()

    await act(async () => submit())

    expect(screen.getByRole('alert')).toHaveTextContent(t.offlineTitle)
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled()
  })
})

describe('deactivated account (4039:4094)', () => {
  it('says so and blocks the button until the email or password changes', async () => {
    renderSignIn(failing(new ApiError('staff_account_deactivated', 403)))
    fill()

    await act(async () => submit())

    expect(screen.getByRole('alert')).toHaveTextContent(t.deactivatedTitle)
    expect(screen.getByRole('alert')).toHaveTextContent(t.deactivatedText)
    expect(screen.getByRole('button', { name: t.submit })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(t.email), { target: { value: 'otra@uprm.example.edu' } })
    expect(screen.getByRole('button', { name: t.submit })).toBeEnabled()
  })
})

describe('other answers', () => {
  it('shows the field rules the server sends', async () => {
    renderSignIn(failing(new ApiError('validation_failed', 422, { email: ['max'] })))
    fill()

    await act(async () => submit())

    expect(screen.getByLabelText(t.email)).toHaveAccessibleDescription(es.validation.max)
  })

  it('shows any other error with its text, never the raw code', async () => {
    renderSignIn(failing(new ApiError('server_error', 500)))
    fill()

    await act(async () => submit())

    expect(screen.getByRole('alert')).toHaveTextContent(es.errors.server_error)
    expect(screen.getByRole('alert')).not.toHaveTextContent('server_error')
  })
})

describe('language', () => {
  it('is in English for an English device session', () => {
    render(
      <I18nProvider locale="en">
        <StaffSignIn onSignIn={async () => {}} />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { level: 1, name: en.signIn.title })).toBeInTheDocument()
    expect(screen.getByLabelText(en.signIn.email)).toBeInTheDocument()
  })
})
