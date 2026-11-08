import { useEffect, useId, useRef, useState } from 'react'
import { ApiError, apiDownload } from '../../api/client'
import { Button, Modal } from '../../components'
import { useMessages } from '../../i18n'
import { useConnection } from '../../user/useConnection'
import { ProblemNotice } from '../ProblemNotice'

// "Descargar roster" (Figma 4039:2032) and "Preparando archivo" (4039:2077), REQ-F-100, #21. The server builds the
// whole roster in the chosen format; this dialog asks for it once and saves what comes back.

type Format = 'docx' | 'pdf'

type DownloadDialogProps = {
  onClose: () => void
  onDownloaded: () => void
  /** Passes API errors to the staff session, so an ended sign-in goes back to N-11. */
  onError: (error: unknown) => void
}

/** Saves a file the browser already holds, with the server's name for it. */
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // The browser has started the download by now; the object URL is no longer needed.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function DownloadDialog({ onClose, onDownloaded, onError }: DownloadDialogProps) {
  const texts = useMessages()
  const t = texts.roster
  const online = useConnection()
  const titleId = useId()
  const formatId = useId()
  const [format, setFormat] = useState<Format>('docx')
  const [preparing, setPreparing] = useState(false)
  const [problem, setProblem] = useState<ApiError | null>(null)
  // The guard against a second download while the file is prepared (4039:2077).
  const busy = useRef(false)
  // Descargar is gone once the file is prepared, so focus goes to the new title instead of the page.
  const preparingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (preparing) preparingRef.current?.focus()
  }, [preparing])

  async function download() {
    if (busy.current || !online) return
    busy.current = true
    setPreparing(true)
    setProblem(null)
    try {
      const { blob, filename } = await apiDownload(`/staff/roster/download?format=${format}`)
      save(blob, filename)
      onDownloaded()
    } catch (error) {
      onError(error)
      setProblem(error instanceof ApiError ? error : new ApiError('server_error', 500))
      setPreparing(false)
    } finally {
      busy.current = false
    }
  }

  function close() {
    if (!busy.current) onClose()
  }

  if (preparing) {
    return (
      <Modal labelledBy={titleId} onClose={close}>
        <div className="modal__body" role="status">
          <h2 className="modal__title" id={titleId} ref={preparingRef} tabIndex={-1}>
            {t.preparingTitle}
          </h2>
          <p className="modal__text">{t.preparingText(format === 'docx' ? t.wordName : t.pdfName)}</p>
          <div className="modal__actions">
            <Button aria-disabled="true">{t.preparing}</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal labelledBy={titleId} onClose={close}>
      <div className="modal__body">
        <h2 className="modal__title" id={titleId}>
          {t.downloadTitle}
        </h2>
        <p className="modal__text">{t.downloadText}</p>
        <ProblemNotice problem={problem} />
        <div role="group" aria-labelledby={formatId} className="roster-format">
          <p className="field__label" id={formatId}>
            {t.format}
          </p>
          <div className="roster-format__options">
            {(['docx', 'pdf'] as const).map((option) => (
              <Button
                key={option}
                variant={format === option ? 'primary' : 'secondary'}
                aria-pressed={format === option}
                onClick={() => setFormat(option)}
              >
                {option === 'docx' ? t.word : t.pdf}
              </Button>
            ))}
          </div>
        </div>
        <section className="roster-whole">
          <h3 className="roster-whole__title">{t.wholeTitle}</h3>
          <p className="roster-whole__text">{t.wholeText}</p>
        </section>
        <div className="modal__actions">
          <Button aria-disabled={!online || undefined} onClick={() => void download()}>
            {t.downloadConfirm}
          </Button>
          <Button variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
