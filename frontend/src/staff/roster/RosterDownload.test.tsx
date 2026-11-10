import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { es } from '../../i18n/es'
import { StaffApp } from '../StaffApp'
import { STAFF_ROSTER_PATH } from '../staffPath'
import { apiError, callsTo, fakeApi, json, lorena } from '../team/fakeTeamApi'

// "Descargar roster" on A-05 (Figma 4039:2032 and 4039:2077, REQ-F-100, #21).

const t = es.roster
const alina = {
  id: 1,
  name: 'Alina Mercado Cruz',
  sport: 'Voleibol',
  student_number: '802612346',
  institutional_email: 'alina.mercado@upr.edu',
  status: 'active',
}

function file(name: string, type: string) {
  return () =>
    // A text body: a jsdom Blob is not one Node's Response accepts.
    new Response('file', {
      status: 200,
      headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename=${name}` },
    })
}

let saved: { href: string; download: string; onPage: boolean }[] = []

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=token; path=/'
  window.history.pushState(null, '', STAFF_ROSTER_PATH)
  saved = []
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:roster'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push({ href: this.href, download: this.download, onPage: document.body.contains(this) })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.history.pushState(null, '', '/')
})

async function openDialog(routes: Parameters<typeof fakeApi>[0] = {}) {
  const fetchMock = fakeApi({
    '/api/staff/me': () => json(lorena),
    '/api/staff/roster?status=active': () => json({ athletes: [alina], active_count: 1 }),
    ...routes,
  })
  render(<StaffApp />)
  fireEvent.click(await screen.findByRole('button', { name: t.download }))
  return { fetchMock, dialog: screen.getByRole('dialog', { name: t.downloadTitle }) }
}

describe('downloading the roster', () => {
  it('downloads the whole roster as Word by default', async () => {
    const { fetchMock, dialog } = await openDialog({
      '/api/staff/roster/download?format=docx': file('roster-atletas-2026-11-08.docx', 'application/octet-stream'),
    })
    expect(within(dialog).getByText(t.downloadText)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: t.word })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: t.pdf })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByText(t.wholeText)).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: t.downloadConfirm }))

    expect(within(dialog).getByRole('heading', { name: t.preparingTitle })).toBeInTheDocument()
    expect(within(dialog).getByText(t.preparingText(t.wordName))).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: t.preparing })).toHaveAttribute('aria-disabled', 'true')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(saved).toEqual([{ href: 'blob:roster', download: 'roster-atletas-2026-11-08.docx', onPage: true }])
    expect(document.querySelector('a[download]')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(t.downloaded)
    expect(callsTo(fetchMock, '/api/staff/roster/download?format=docx')).toHaveLength(1)
  })

  it('downloads it as PDF when chosen', async () => {
    const { fetchMock, dialog } = await openDialog({
      '/api/staff/roster/download?format=pdf': file('roster-atletas-2026-11-08.pdf', 'application/pdf'),
    })

    fireEvent.click(within(dialog).getByRole('button', { name: t.pdf }))
    expect(within(dialog).getByRole('button', { name: t.pdf })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(dialog).getByRole('button', { name: t.downloadConfirm }))

    await waitFor(() => expect(saved).toEqual([{ href: 'blob:roster', download: 'roster-atletas-2026-11-08.pdf', onPage: true }]))
    expect(callsTo(fetchMock, '/api/staff/roster/download?format=pdf')).toHaveLength(1)
  })

  it('stays open and says why when the file cannot be made', async () => {
    const { dialog } = await openDialog({
      '/api/staff/roster/download?format=docx': () => apiError('server_error', 500),
    })

    fireEvent.click(within(dialog).getByRole('button', { name: t.downloadConfirm }))

    expect((await within(dialog).findByText(es.errors.server_error)).closest('.notice')).toHaveClass('notice--error')
    expect(within(dialog).getByRole('heading', { name: t.downloadTitle })).toBeInTheDocument()
    expect(saved).toEqual([])
  })

  it('closes with Cancelar and asks for nothing', async () => {
    const { fetchMock, dialog } = await openDialog()

    fireEvent.click(within(dialog).getByRole('button', { name: t.cancel }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([path]) => String(path).includes('download'))).toEqual([])
  })
})
