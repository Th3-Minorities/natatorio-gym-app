import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_BACKUPS_PATH, STAFF_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, goOffline, goOnline, json, lorena } from '../team/fakeTeamApi'

// A-16 "Respaldos" (Figma 4799:662, 4799:667, 4799:675 and the states in section 170:3067, #86).

const t = es.backups
const BACKUPS = '/api/staff/backups'
const nov4 = { name: 'backup-2026-11-04-020000.tar', created_at: '2026-11-04T06:00:00.000000Z', size: 1_280_000_000 }
const oct21 = { name: 'backup-2026-10-21-020000.tar', created_at: '2026-10-21T06:00:00.000000Z', size: 1_240_000_000 }

function status(changes: object = {}) {
  return {
    running: false,
    running_kind: null,
    running_name: null,
    backups: [nov4, oct21],
    kept: 2,
    next_at: '2026-11-18T06:00:00.000000Z',
    failed_at: null,
    last_restore: null,
    ...changes,
  }
}

/** A restore of the 4 nov copy that ended on 10 nov, after the newest copy. */
function restored(ok: boolean, at = '2026-11-10T15:00:00.000000Z') {
  return { name: nov4.name, ok, at, audit_csv: 'audit-after-2026-11-04-020000-restored-2026-11-10-110000.csv' }
}

let saved: string[] = []

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_BACKUPS_PATH)
  saved = []
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:backup'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  goOnline()
  window.history.pushState(null, '', '/')
})

/** answers: what GET /api/staff/backups returns, one per call; the last one repeats. */
async function openScreen(answers: object[] = [status()], routes: Parameters<typeof fakeApi>[0] = {}) {
  let call = 0
  const fetchMock = fakeApi({
    '/api/staff/me': () => json(lorena),
    [BACKUPS]: () => json(answers[Math.min(call++, answers.length - 1)]),
    ...routes,
  })
  render(<StaffApp />)
  await screen.findByRole('heading', { level: 1, name: t.title })
  return fetchMock
}

describe('the backups screen', () => {
  it('opens from "Respaldos" in the menu', async () => {
    window.history.pushState(null, '', STAFF_PATH)
    fakeApi({
      '/api/staff/me': () => json(lorena),
      [BACKUPS]: () => json(status()),
    })
    render(<StaffApp />)

    fireEvent.click(await screen.findByRole('link', { name: es.dashboard.adminItems.backups }))

    expect(window.location.pathname).toBe(STAFF_BACKUPS_PATH)
    expect(await screen.findByRole('heading', { level: 1, name: t.title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: es.dashboard.adminItems.backups })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the last and next backup, the copies kept and each copy with its actions', async () => {
    await openScreen()

    expect(await screen.findByText(t.lastBackup)).toBeInTheDocument()
    expect(screen.getByText(t.activeTerm)).toBeInTheDocument()
    expect(screen.getByText('Agosto - diciembre 2026')).toBeInTheDocument()
    expect(screen.getByText(t.nextAutomatic)).toBeInTheDocument()
    expect(screen.getByText('18 nov 2026 · 2:00 a. m.')).toBeInTheDocument()
    expect(screen.getByText('2 de 2 conservadas')).toBeInTheDocument()
    const rows = within(screen.getByRole('table', { name: t.listTitle })).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('4 nov 2026 · 2:00 a. m.')).toBeInTheDocument()
    expect(within(rows[1]).getByText(t.correct)).toBeInTheDocument()
    expect(within(rows[1]).getByText(t.databaseAndPhotos)).toBeInTheDocument()
    expect(within(rows[1]).getByText('1.28 GB')).toBeInTheDocument()
    expect(within(rows[2]).getByText('1.24 GB')).toBeInTheDocument()
    expect(within(rows[1]).getByRole('button', { name: `${t.download}, 4 nov 2026 · 2:00 a. m.` })).toBeInTheDocument()
    expect(within(rows[2]).getByRole('button', { name: `${t.restore}, 21 oct 2026 · 2:00 a. m.` })).toBeInTheDocument()
    expect(screen.getByText(t.encryptedText)).toBeInTheDocument()
    expect(screen.getByText(t.replacesText)).toBeInTheDocument()
    expect(screen.getByText(t.footnote)).toBeInTheDocument()
  })

  it('says it is loading first', async () => {
    fakeApi({ '/api/staff/me': () => json(lorena), [BACKUPS]: () => new Promise(() => {}) })
    render(<StaffApp />)

    expect(await screen.findByText(t.loadingTitle)).toBeInTheDocument()
    expect(screen.getByText(t.loadingText)).toBeInTheDocument()
  })

  it('shows the empty state without download or restore when there is no copy', async () => {
    await openScreen([status({ backups: [] })])

    expect(await screen.findByRole('heading', { name: t.emptyTitle })).toBeInTheDocument()
    expect(screen.getByText(t.emptyLead)).toBeInTheDocument()
    expect(screen.getByText(t.emptyText('18 nov 2026, 2:00 a. m.'))).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: new RegExp(t.restore) })).not.toBeInTheDocument()
  })

  it('backs up now, shows Respaldando while it runs and asks again until it ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const newer = { name: 'backup-2026-11-18-101500.tar', created_at: '2026-11-18T14:15:00.000000Z', size: 1_300_000_000 }
    const fetchMock = await openScreen([status(), status({ running: true }), status({ backups: [newer, nov4] })], {
      [`POST ${BACKUPS}`]: () => json({ running: true }, 202),
    })
    await screen.findByText(t.lastBackup)

    fireEvent.click(screen.getAllByRole('button', { name: t.backUpNow })[0])

    expect(await screen.findByRole('heading', { name: t.runningTitle })).toBeInTheDocument()
    expect(screen.getByText(t.runningText)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.running })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: t.backUpNow })).toHaveAttribute('aria-disabled', 'true')
    expect(callsTo(fetchMock, BACKUPS).filter(([method]) => method === 'POST')).toHaveLength(1)
    // The next check is timed from the end of the one that just ran.
    await waitFor(() => expect(callsTo(fetchMock, BACKUPS)).toHaveLength(3))
    await act(async () => {})
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(await screen.findAllByText('18 nov 2026 · 10:15 a. m.')).toHaveLength(2)
    expect(screen.queryByRole('heading', { name: t.runningTitle })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.backUpNow })).not.toHaveAttribute('aria-disabled')
  })

  it('shows Restaurando when a restore started elsewhere is running, and Respaldando for a backup', async () => {
    await openScreen([status({ running: true, running_kind: 'restore', running_name: nov4.name })])

    expect(await screen.findByRole('heading', { name: t.restoringTitle })).toBeInTheDocument()
    expect(screen.getByText(t.restoringText('4 nov 2026'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.restoring })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('heading', { name: t.runningTitle })).not.toBeInTheDocument()
    cleanup()

    await openScreen([status({ running: true, running_kind: 'backup' })])

    expect(await screen.findByRole('heading', { name: t.runningTitle })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: t.restoringTitle })).not.toBeInTheDocument()
  })

  it('asks again only after the previous check has ended, never two at once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let release: (answer: Response) => void = () => {}
    let call = 0
    const fetchMock = fakeApi({
      '/api/staff/me': () => json(lorena),
      [BACKUPS]: () => {
        call += 1
        if (call === 1) return json(status({ running: true }))
        if (call === 2) return new Promise<Response>((resolve) => (release = resolve))
        return json(status())
      },
    })
    render(<StaffApp />)
    await screen.findByRole('heading', { name: t.runningTitle })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(callsTo(fetchMock, BACKUPS)).toHaveLength(2))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(callsTo(fetchMock, BACKUPS)).toHaveLength(2)

    await act(async () => {
      release(json(status({ running: true })))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })
    await waitFor(() => expect(callsTo(fetchMock, BACKUPS)).toHaveLength(3))
  })

  it('shows a failed backup apart from the last good one, with a retry', async () => {
    await openScreen([status({ failed_at: '2026-11-05T14:15:00.000000Z' })])

    expect(await screen.findByRole('heading', { name: t.failedTitle })).toBeInTheDocument()
    expect(screen.getByText(t.failedLead('5 nov 2026', '10:15 a. m.'))).toBeInTheDocument()
    expect(screen.getByText(t.failedText(2, '4 nov 2026, 2:00 a. m.'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.retryBackup })).toBeInTheDocument()
  })

  it('says there is no copy yet when the first backup fails', async () => {
    await openScreen([status({ backups: [], failed_at: '2026-11-05T14:15:00.000000Z' })])

    expect(await screen.findByRole('heading', { name: t.failedTitle })).toBeInTheDocument()
    expect(screen.getByText(t.failedLead('5 nov 2026', '10:15 a. m.'))).toBeInTheDocument()
    expect(screen.getByText(t.failedNoCopy)).toBeInTheDocument()
    expect(screen.queryByText(/siguen disponibles/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.retryBackup })).toBeInTheDocument()
  })

  it('disables every action without a connection and says so', async () => {
    await openScreen()
    await screen.findByText(t.lastBackup)

    act(() => goOffline())

    expect(screen.getByText(t.offlineLead)).toBeInTheDocument()
    expect(screen.getByText(t.offlineText)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.backUpNow })).toHaveAttribute('aria-disabled', 'true')
    const download = screen.getByRole('button', { name: `${t.download}, 4 nov 2026 · 2:00 a. m.` })
    expect(download).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(download)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('the encrypted download', () => {
  async function openDownload(routes: Parameters<typeof fakeApi>[0] = {}) {
    const fetchMock = await openScreen([status()], routes)
    fireEvent.click(await screen.findByRole('button', { name: `${t.download}, 4 nov 2026 · 2:00 a. m.` }))
    return { fetchMock, dialog: screen.getByRole('dialog', { name: t.downloadTitle }) }
  }

  const DOWNLOAD = `/api/staff/backups/${nov4.name}/download`

  it('asks for the password twice and refuses empty or different ones without calling the server', async () => {
    const { fetchMock, dialog } = await openDownload()
    expect(within(dialog).getByText(t.copyOf('4 nov 2026', '2:00 a. m.'))).toBeInTheDocument()
    expect(within(dialog).getByText(t.downloadText)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: t.downloadConfirm }))
    expect(within(dialog).getByLabelText(t.password)).toHaveAccessibleDescription(es.validation.required)

    fireEvent.change(within(dialog).getByLabelText(t.password), { target: { value: 'correct horse battery' } })
    fireEvent.change(within(dialog).getByLabelText(t.repeatPassword), { target: { value: 'correct horse batery' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.downloadConfirm }))

    expect(within(dialog).getByLabelText(t.repeatPassword)).toHaveAccessibleDescription(es.validation.confirmed)
    expect(callsTo(fetchMock, DOWNLOAD)).toEqual([])
  })

  it('sends the password in the body and saves the encrypted file', async () => {
    const { fetchMock, dialog } = await openDownload({
      [`POST ${DOWNLOAD}`]: () =>
        new Response('encrypted', { status: 200, headers: { 'Content-Disposition': `attachment; filename=${nov4.name}.enc` } }),
    })

    fireEvent.change(within(dialog).getByLabelText(t.password), { target: { value: 'correct horse battery' } })
    fireEvent.change(within(dialog).getByLabelText(t.repeatPassword), { target: { value: 'correct horse battery' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.downloadConfirm }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(saved).toEqual([`${nov4.name}.enc`])
    expect(callsTo(fetchMock, DOWNLOAD)).toEqual([
      ['POST', { password: 'correct horse battery', password_confirmation: 'correct horse battery' }],
    ])
  })

  it('shows the server rule on the password field', async () => {
    const { dialog } = await openDownload({ [`POST ${DOWNLOAD}`]: () => apiError('validation_failed', 422, { password: ['min'] }) })

    fireEvent.change(within(dialog).getByLabelText(t.password), { target: { value: 'short' } })
    fireEvent.change(within(dialog).getByLabelText(t.repeatPassword), { target: { value: 'short' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.downloadConfirm }))

    await waitFor(() => expect(within(dialog).getByLabelText(t.password)).toHaveAccessibleDescription(es.validation.min))
    expect(saved).toEqual([])
  })
})

describe('the restore', () => {
  const RESTORE = `/api/staff/backups/${nov4.name}/restore`

  async function openRestore(answers: object[], routes: Parameters<typeof fakeApi>[0] = {}) {
    const fetchMock = await openScreen(answers, { [`POST ${RESTORE}`]: () => json({ running: true }, 202), ...routes })
    fireEvent.click(await screen.findByRole('button', { name: `${t.restore}, 4 nov 2026 · 2:00 a. m.` }))
    return { fetchMock, dialog: screen.getByRole('dialog', { name: t.restoreTitle }) }
  }

  it('works only once RESTAURAR is typed exactly', async () => {
    const { fetchMock, dialog } = await openRestore([status()])
    expect(within(dialog).getByText(t.restoreLead('4 nov 2026', '2:00 a. m.'))).toBeInTheDocument()
    expect(within(dialog).getByText(t.restoreText)).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: t.restoreConfirm })

    fireEvent.change(within(dialog).getByLabelText(t.confirmLabel), { target: { value: 'restaurar' } })
    expect(confirm).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(confirm)
    expect(callsTo(fetchMock, RESTORE)).toEqual([])

    fireEvent.change(within(dialog).getByLabelText(t.confirmLabel), { target: { value: 'RESTAURAR' } })
    expect(confirm).not.toHaveAttribute('aria-disabled')
  })

  it('restores, waits for the end and closes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { fetchMock, dialog } = await openRestore([
      status(),
      status({ running: true }),
      status({ last_restore: restored(true) }),
    ])

    fireEvent.change(within(dialog).getByLabelText(t.confirmLabel), { target: { value: 'RESTAURAR' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.restoreConfirm }))

    await waitFor(() => expect(callsTo(fetchMock, RESTORE)).toEqual([['POST', { confirmation: 'RESTAURAR' }]]))
    await waitFor(() => expect(callsTo(fetchMock, BACKUPS)).toHaveLength(2))
    // The dialog gives way to the "Restaurando" state, with the term chip only at the top of the page.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t.restoringTitle })).toBeInTheDocument()
    expect(screen.getByText(t.restoringText('4 nov 2026'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: t.restoring })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('heading', { name: t.runningTitle })).not.toBeInTheDocument()
    expect(screen.getAllByText(t.activeTerm)).toHaveLength(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    await waitFor(() => expect(screen.queryByRole('heading', { name: t.restoringTitle })).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: t.restoreFailedTitle })).not.toBeInTheDocument()
    expect(screen.getByText(t.restored('4 nov 2026'))).toBeInTheDocument()
  })

  it('tells the Admin who signs in again that the last restore worked and closed every session', async () => {
    await openScreen([status({ last_restore: restored(true) })])

    const message = await screen.findByText(t.restored('4 nov 2026'))
    expect(message).toHaveTextContent('Se restauró la copia del 4 nov 2026. Por seguridad, se cerraron todas las sesiones.')
    // The same confirmation card as the term and roster ones: the term chip and the bold line, in the status region.
    expect(message.closest('[role="status"]')).not.toBeNull()
    expect(message.closest('.saved-card')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: t.restoreFailedTitle })).not.toBeInTheDocument()
  })

  it('shows a failed restore when the Admin opens the screen, until Volver a respaldos', async () => {
    await openScreen([status({ last_restore: restored(false) })])

    expect(await screen.findByRole('heading', { name: t.restoreFailedTitle })).toBeInTheDocument()
    expect(screen.getByText(t.restoreFailedLead('4 nov 2026'))).toBeInTheDocument()
    expect(screen.queryByText(t.restored('4 nov 2026'))).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.backToBackups }))
    expect(screen.queryByRole('heading', { name: t.restoreFailedTitle })).not.toBeInTheDocument()
  })

  it('drops the restore result once a newer backup or a newer failure exists, or while one runs', async () => {
    const newer = { name: 'backup-2026-11-12-020000.tar', created_at: '2026-11-12T06:00:00.000000Z', size: 1_300_000_000 }
    await openScreen([status({ backups: [newer, nov4], last_restore: restored(true) })])
    expect(await screen.findByText(t.lastBackup)).toBeInTheDocument()
    expect(screen.queryByText(t.restored('4 nov 2026'))).not.toBeInTheDocument()
    cleanup()

    await openScreen([status({ failed_at: '2026-11-12T06:00:00.000000Z', last_restore: restored(false) })])
    expect(await screen.findByText(t.lastBackup)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: t.restoreFailedTitle })).not.toBeInTheDocument()
    cleanup()

    await openScreen([status({ running: true, last_restore: restored(true) })])
    expect(await screen.findByRole('heading', { name: t.runningTitle })).toBeInTheDocument()
    expect(screen.queryByText(t.restored('4 nov 2026'))).not.toBeInTheDocument()
  })

  it('shows the restore error when it fails, and Volver a respaldos dismisses it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { fetchMock, dialog } = await openRestore([status(), status({ running: true }), status({ last_restore: restored(false) })])

    fireEvent.change(within(dialog).getByLabelText(t.confirmLabel), { target: { value: 'RESTAURAR' } })
    fireEvent.click(within(dialog).getByRole('button', { name: t.restoreConfirm }))
    // The check right after the restore starts, which still sees it running.
    await waitFor(() => expect(callsTo(fetchMock, BACKUPS)).toHaveLength(2))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(await screen.findByRole('heading', { name: t.restoreFailedTitle })).toBeInTheDocument()
    expect(screen.getByText(t.restoreFailedLead('4 nov 2026'))).toBeInTheDocument()
    expect(screen.getByText(t.restoreFailedText)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.backToBackups }))
    expect(screen.queryByRole('heading', { name: t.restoreFailedTitle })).not.toBeInTheDocument()
  })

  it('shows a typed script as plain text, never as HTML', async () => {
    const { dialog } = await openRestore([status()])
    const field = within(dialog).getByLabelText(t.confirmLabel)

    fireEvent.change(field, { target: { value: '<img src=x onerror=alert(1)>' } })

    expect(field).toHaveValue('<img src=x onerror=alert(1)>')
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(within(dialog).getByRole('button', { name: t.restoreConfirm })).toHaveAttribute('aria-disabled', 'true')
  })
})
