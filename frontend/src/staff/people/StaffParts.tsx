import { useId, useState, type ReactNode } from 'react'
import { Button, Modal } from '../../components'
import { useMessages } from '../../i18n'
import { initials } from './personText'

// Pieces S-01, S-02 and S-03 share (#26): an in-app link, the ID photo and a confirmation dialog.

/** A link that changes the page without reloading; Ctrl, Cmd, Shift or a middle click still opens a new tab. */
export function StaffLink({
  href,
  navigate,
  className,
  children,
  'aria-label': label,
}: {
  href: string
  navigate?: (path: string) => void
  className?: string
  children: ReactNode
  'aria-label'?: string
}) {
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      onClick={(event) => {
        if (!navigate || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(href)
      }}
    >
      {children}
    </a>
  )
}

/**
 * The ID photo Staff compare with the person (REQ-F-45). The initials stay until it loads, and stay if there is no
 * photo or it fails, so Staff never see a broken image. The photo route is private and never cached.
 */
export function PersonPhoto({ src, name, size, onSettled, showLoadingCaption = true }: {
  src: string | null
  name: string | null
  size: 'small' | 'large'
  onSettled?: () => void
  showLoadingCaption?: boolean
}) {
  const t = useMessages().sessionDetail
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>(src ? 'loading' : 'failed')

  return (
    <div className={`person-photo person-photo--${size}`}>
      {state !== 'shown' && (
        <span className="person-photo__initials" aria-hidden="true">
          {initials(name)}
        </span>
      )}
      {size === 'large' && (state === 'failed' || (state === 'loading' && showLoadingCaption)) && (
        <span className="person-photo__caption">{state === 'loading' ? t.photoLoading : t.photo}</span>
      )}
      {src && state !== 'failed' && (
        <img
          src={src}
          alt={size === 'large' ? t.photo : ''}
          className={state === 'shown' ? 'person-photo__img' : 'person-photo__img person-photo__img--hidden'}
          onLoad={() => {
            setState('shown')
            onSettled?.()
          }}
          onError={() => {
            setState('failed')
            onSettled?.()
          }}
        />
      )}
    </div>
  )
}

/** A question before an action (Figma 122:3002, 122:3040 to 122:3094, 4288:1920, 4288:2028). */
export function ConfirmDialog({
  title,
  question,
  text,
  meta,
  note,
  confirm,
  danger = false,
  busy = false,
  problem,
  onConfirm,
  onClose,
}: {
  title: string
  /** The line under the title that asks what will happen, like "¿Marcar la salida de Ana?". */
  question?: string
  text: string
  meta?: string
  note?: string
  confirm: string
  danger?: boolean
  busy?: boolean
  problem?: ReactNode
  onConfirm: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const cancel = useMessages().sessionDetail.cancel

  return (
    <Modal labelledBy={titleId} onClose={() => !busy && onClose()}>
      <div className="modal__body">
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        {question && <p className="modal__text">{question}</p>}
        {meta && <p className="confirm-meta">{meta}</p>}
        <p className="modal__text">{text}</p>
        {note && <p className="modal__text">{note}</p>}
        {problem}
        <div className="modal__actions">
          <Button className={danger ? 'button--danger' : undefined} aria-disabled={busy || undefined} onClick={() => !busy && onConfirm()}>
            {confirm}
          </Button>
          <Button variant="secondary" onClick={() => !busy && onClose()}>
            {cancel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
