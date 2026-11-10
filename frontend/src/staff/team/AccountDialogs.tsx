import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ApiError, apiRequest } from '../../api/client'
import { Button, Modal } from '../../components'
import { useMessages } from '../../i18n'
import { ProblemNotice } from '../ProblemNotice'
import type { TeamAccount } from './StaffTeam'

// The A-15 modals for one account (#84): change role (Figma 4039:3226), your own role (4039:3285)
// and deactivate (100:1205).

type DialogProps = {
  account: TeamAccount
  onClose: () => void
  /** The account as the API answered after the change. */
  onDone: (account: TeamAccount) => void
  /** Passes API errors to the staff session, so an ended sign-in goes back to N-11. */
  onError: (error: unknown) => void
}

/** Sends one change and keeps its refusal to show inside the modal. */
function useChange(onDone: DialogProps['onDone'], onError: DialogProps['onError'], onClose: DialogProps['onClose']) {
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)
  // The guard against a second send; the button is aria-disabled, so it keeps keyboard focus.
  const busy = useRef(false)

  async function run(path: string, method: 'POST' | 'PATCH', body?: unknown) {
    if (busy.current) return
    busy.current = true
    setSending(true)
    setProblem(null)
    try {
      const { account } = await apiRequest<{ account: TeamAccount }>(path, { method, body })
      onDone(account)
    } catch (error) {
      onError(error)
      setProblem(error instanceof ApiError ? error : new ApiError('server_error', 500))
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  /** Esc and Cancelar close the modal only when no change is being sent. */
  function close() {
    if (!busy.current) onClose()
  }

  return { sending, problem, run, close }
}

export function RoleDialog({ account, onClose, onDone, onError }: DialogProps) {
  const texts = useMessages()
  const t = texts.staffTeam
  const titleId = useId()
  // Figma starts on the role the account does not have: that is the change being made.
  const [role, setRole] = useState<TeamAccount['role']>(account.role === 'staff' ? 'admin' : 'staff')
  const { sending, problem, run, close } = useChange(onDone, onError, onClose)

  function save(event: FormEvent) {
    event.preventDefault()
    // The same role as now: nothing to change, so nothing is sent and no "Rol cambiado" appears.
    if (role === account.role) {
      close()
      return
    }
    void run(`/staff/accounts/${account.id}/role`, 'PATCH', { role })
  }

  return (
    <Modal labelledBy={titleId} onClose={close}>
      <form className="modal__body" noValidate onSubmit={save}>
        <h2 className="modal__title" id={titleId}>
          {t.changeRole}
        </h2>
        <p className="modal__name">{account.name}</p>
        <div className="modal__text">
          <p>{account.email}</p>
          <p>{t.currentRole(texts.dashboard.roles[account.role])}</p>
        </div>
        <ProblemNotice problem={problem} tone="error" />
        <fieldset className="choice">
          <legend className="field__label">{t.newRole}</legend>
          <div className="choice__options">
            {(['staff', 'admin'] as const).map((option) => (
              <label key={option} className="choice__option">
                <input type="radio" name="role" value={option} checked={role === option} onChange={() => setRole(option)} />
                <span>{texts.dashboard.roles[option]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="modal__text">{t.roleAudit}</p>
        <div className="modal__actions">
          <Button type="submit" aria-disabled={sending || undefined}>
            {t.save}
          </Button>
          <Button variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** "No puedes cambiar tu propio rol": shown without asking the API, which refuses it too. */
export function OwnRoleDialog({ account, onClose }: Pick<DialogProps, 'account' | 'onClose'>) {
  const texts = useMessages()
  const t = texts.staffTeam
  const titleId = useId()
  const role = texts.dashboard.roles[account.role]

  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <div className="modal__body">
        <h2 className="modal__title" id={titleId}>
          {t.ownRoleTitle}
        </h2>
        <p className="modal__name">
          {account.name} · {role}
        </p>
        <p className="modal__text">{t.ownRoleText(role)}</p>
        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose}>
            {t.understood}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function DeactivateDialog({ account, onClose, onDone, onError }: DialogProps) {
  const t = useMessages().staffTeam
  const titleId = useId()
  const { sending, problem, run, close } = useChange(onDone, onError, onClose)
  const actions = useRef<HTMLDivElement>(null)

  // Cancelar first: the other button is destructive (WAI-ARIA APG). After the modal opens, so it wins over the browser's pick.
  useEffect(() => actions.current?.querySelector<HTMLElement>('[data-initial-focus]')?.focus(), [])

  return (
    <Modal labelledBy={titleId} onClose={close}>
      <div className="modal__body">
        <h2 className="modal__title" id={titleId}>
          {t.deactivateTitle(account.name)}
        </h2>
        <p className="modal__text">{t.deactivateText}</p>
        <ProblemNotice problem={problem} tone="error" />
        <div className="modal__actions" ref={actions}>
          <Button
            aria-disabled={sending || undefined}
            onClick={() => void run(`/staff/accounts/${account.id}/deactivate`, 'POST')}
          >
            {t.deactivateConfirm}
          </Button>
          <Button variant="secondary" data-initial-focus onClick={close}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
