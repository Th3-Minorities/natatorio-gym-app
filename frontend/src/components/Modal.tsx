import { useLayoutEffect, useRef, type ReactNode } from 'react'

type ModalProps = {
  /** id of the modal's heading, which names it for screen readers. */
  labelledBy: string
  /** Esc, Cancelar or the work being done: the parent stops rendering the modal. */
  onClose: () => void
  children: ReactNode
}

/**
 * A modal that "bloquea y oscurece el fondo", as Figma's A-15 modals say (100:1126, 100:1205). The native
 * <dialog> keeps keyboard focus inside, closes with Esc and gives focus back to what opened it.
 * Render it only while it is open.
 */
export function Modal({ labelledBy, onClose, children }: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)

  // A layout effect, so close() runs while the dialog is still on the page: the browser then gives focus back.
  useLayoutEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        // Esc: the parent decides, so React's state and the dialog stay in step.
        event.preventDefault()
        onClose()
      }}
    >
      {children}
    </dialog>
  )
}
