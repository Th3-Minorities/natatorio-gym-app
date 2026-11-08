import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useMessages } from '../i18n'

/** Modal help for a denied location permission. Figma 4445:4330 (pop-up) and 4459:4335 (open over the dimmed screen). */
export function LocationHelp({ onClose }: { onClose: () => void }) {
  const t = useMessages().checkIn.help
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => opener?.focus()
  }, [])
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [onClose])

  // The only control is the close button, so Tab moves between the dialog itself and that button.
  function trap(event: KeyboardEvent) {
    if (event.key !== 'Tab') return
    const button = dialog.current?.querySelector('button')
    if (!button) return
    const onButton = document.activeElement === button
    if (event.shiftKey ? !onButton : onButton) {
      event.preventDefault()
      if (event.shiftKey) button.focus()
      else dialog.current?.focus()
    }
  }

  return <div className="check-in-help">
    <div ref={dialog} className="check-in-help__dialog" role="dialog" aria-modal="true" aria-labelledby="check-in-help-title" tabIndex={-1} onKeyDown={trap}>
      <h2 id="check-in-help-title">{t.title}</h2>
      <p>{t.text}</p>
      {[t.ios, t.android].map((system) => <section key={system.name}>
        <h3>{system.name}</h3>
        <ol>{system.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      </section>)}
      <p className="check-in-help__note">{t.note}</p>
      <button type="button" className="button check-in-action" onClick={onClose}>{t.close}</button>
    </div>
  </div>
}
