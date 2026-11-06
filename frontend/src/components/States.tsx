import type { AriaRole, ReactNode } from 'react'
import { useMessages } from '../i18n'
import { Button } from './Button'

type PanelProps = {
  title: string
  /** The bold line, like "No encontramos cuentas para “Lidia Solís”." */
  lead?: ReactNode
  /** The muted line, like "Revisa el nombre o busca por correo electrónico." */
  detail?: ReactNode
  action?: ReactNode
  role?: AriaRole
  kind?: 'error'
}

function StatePanel({ title, lead, detail, action, role, kind }: PanelProps) {
  return (
    <section
      className={kind ? `state state--${kind}` : 'state'}
      role={role}
    >
      <h2 className="state__title">{title}</h2>
      {lead && <p className="state__lead">{lead}</p>}
      {detail && <p className="state__detail">{detail}</p>}
      {action && <div className="state__action">{action}</div>}
    </section>
  )
}

type StateProps = { lead?: ReactNode; detail?: ReactNode }

/** "Cargando", with what is loading, like "Buscando cuentas…". */
export function LoadingState({ detail }: Pick<StateProps, 'detail'>) {
  return <StatePanel role="status" title={useMessages().states.loading} detail={detail} />
}

/** "Sin resultados", with what the screen looked for. */
export function EmptyState({ lead, detail }: StateProps) {
  return <StatePanel role="status" title={useMessages().states.empty} lead={lead} detail={detail} />
}

/** "Error al cargar", with a button to try again. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const texts = useMessages().states
  return (
    <StatePanel
      role="alert"
      kind="error"
      title={texts.errorTitle}
      detail={texts.errorDetail}
      action={
        <Button className="state__button" onClick={onRetry}>
          {texts.retry}
        </Button>
      }
    />
  )
}

/** "Sin conexión". Retry needs both a connection and an action (Figma 132:3777). */
export function OfflineState({ detail, online, onRetry }: Pick<StateProps, 'detail'> & { online?: boolean; onRetry?: () => void }) {
  const texts = useMessages().states
  return (
    <StatePanel
      role="status"
      title={texts.offlineTitle}
      lead={texts.offlineLead}
      detail={detail}
      action={
        <Button className="state__button" disabled={!online || !onRetry} onClick={onRetry}>
          {texts.retry}
        </Button>
      }
    />
  )
}
