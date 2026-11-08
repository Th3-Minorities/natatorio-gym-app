import { useMessages } from '../i18n'
import './registration.css'

/** The N-08 notice card, drawn the same in registration and in My account. */
export function PrivacyNoticeCard({ draft, linked = false }: { draft: boolean; linked?: boolean }) {
  const t = useMessages().registration
  return <section className="registration-notice" aria-label={t.privacy}>
    <div className="registration-notice-heading"><h2>{linked ? <a href="/privacy">{t.privacy}</a> : t.privacy}</h2>{draft && <span>{t.draft}</span>}</div>
    <p>{t.provisional}</p><p>{t.pendingNotice}</p><p>{t.pendingApproval}</p>
  </section>
}
