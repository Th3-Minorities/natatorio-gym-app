import { useMessages } from '../i18n'
import './dashboard.css'

/**
 * "RUM · Gimnasio de pesas" with the orange mark: Figma "Dashboard / Marca" (4124:566), used in the sidebar
 * and on top of the staff sign-in. `inline` keeps the name on one line, as in the sign-in header.
 */
export function Brand({ inline = false }: { inline?: boolean }) {
  const texts = useMessages().dashboard
  return (
    <div className={inline ? 'brand brand--inline' : 'brand'}>
      <p className="brand__campus">{texts.brandCampus}</p>
      <p className="brand__name">{texts.brandName}</p>
      <span className="brand__accent" aria-hidden="true" />
    </div>
  )
}
