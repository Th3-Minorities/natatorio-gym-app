import { useId, useState, type FormEvent } from 'react'
import { ApiError, apiDownload, apiRequest } from '../../api/client'
import { Button, Modal, TextField } from '../../components'
import { useDateFormat } from '../../format/dateTime'
import { fieldErrorText, useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'
import { save } from '../saveFile'
import { TermChip } from '../team/TermStatus'
import type { Backup } from './Backups'

type DialogProps = {
  backup: Backup
  onClose: () => void
  /** Passes API errors to the staff session, so an ended sign-in goes back to N-11. */
  onError: (error: unknown) => void
}

/** "Descargar copia cifrada" (Figma 4799:675): the password twice; the server encrypts the copy with it. */
export function DownloadDialog({ backup, onClose, onError }: DialogProps) {
  const texts = useMessages()
  const t = texts.backups
  const format = useDateFormat()
  const online = useConnection()
  const titleId = useId()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({})
  const [problem, setProblem] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)

  async function download(event: FormEvent) {
    event.preventDefault()
    if (busy || !online) return
    const found = {
      password: password === '' ? fieldErrorText(texts, 'required') : undefined,
      repeat: repeat === '' ? fieldErrorText(texts, 'required') : repeat !== password ? fieldErrorText(texts, 'confirmed') : undefined,
    }
    setErrors(found)
    setProblem(null)
    if (found.password || found.repeat) return

    setBusy(true)
    try {
      const { blob, filename } = await apiDownload(`/staff/backups/${backup.name}/download`, {
        password,
        password_confirmation: repeat,
      })
      save(blob, filename)
      onClose()
    } catch (error) {
      onError(error)
      const rule = error instanceof ApiError ? error.details?.password?.[0] : undefined
      if (rule) setErrors({ password: fieldErrorText(texts, rule) })
      else setProblem(error instanceof ApiError ? error : new ApiError('server_error', 500))
      setBusy(false)
    }
  }

  return (
    <Modal labelledBy={titleId} onClose={() => !busy && onClose()}>
      <form className="modal__body" noValidate onSubmit={(event) => void download(event)}>
        <TermChip />
        <h2 className="modal__title" id={titleId}>
          {t.downloadTitle}
        </h2>
        <p className="backups-modal__lead">{t.copyOf(format.date(backup.created_at), format.time(backup.created_at))}</p>
        <p className="modal__text">{t.downloadText}</p>
        <ProblemNotice problem={problem} tone="error" />
        <TextField
          label={t.password}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          error={errors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label={t.repeatPassword}
          type="password"
          autoComplete="new-password"
          required
          value={repeat}
          error={errors.repeat}
          onChange={(event) => setRepeat(event.target.value)}
        />
        <div className="modal__actions">
          <Button type="submit" aria-disabled={busy || !online || undefined}>
            {t.downloadConfirm}
          </Button>
          <Button variant="secondary" onClick={() => !busy && onClose()}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * "Confirmar restauración" (Figma 116:2542). The button works only once RESTAURAR is typed; the server checks it too.
 * The screen closes it when the restore starts and shows "Restaurando" instead.
 */
export function RestoreDialog({ backup, onClose, onError, onStarted }: DialogProps & { onStarted: () => void }) {
  const t = useMessages().backups
  const format = useDateFormat()
  const online = useConnection()
  const titleId = useId()
  const [typed, setTyped] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)
  const ready = typed === t.confirmWord && online && !sending

  async function restore(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setSending(true)
    setProblem(null)
    try {
      await apiRequest(`/staff/backups/${backup.name}/restore`, { method: 'POST', body: { confirmation: typed } })
      onStarted()
    } catch (error) {
      onError(error)
      setProblem(error instanceof ApiError ? error : new ApiError('server_error', 500))
    } finally {
      setSending(false)
    }
  }

  const close = () => !sending && onClose()

  return (
    <Modal labelledBy={titleId} onClose={close}>
      <form className="modal__body" noValidate onSubmit={(event) => void restore(event)}>
        <TermChip />
        <h2 className="modal__title" id={titleId}>
          {t.restoreTitle}
        </h2>
        <p className="backups-modal__lead">{t.restoreLead(format.date(backup.created_at), format.time(backup.created_at))}</p>
        <p className="modal__text">{t.restoreText}</p>
        <ProblemNotice problem={problem} tone="error" />
        <TextField
          label={t.confirmLabel}
          autoComplete="off"
          spellCheck={false}
          required
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
        <div className="modal__actions">
          <Button type="submit" aria-disabled={!ready || undefined}>
            {t.restoreConfirm}
          </Button>
          <Button variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
