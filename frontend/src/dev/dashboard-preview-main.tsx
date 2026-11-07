import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from '../components'
import { DashboardShell } from '../dashboard/DashboardShell'
import { I18nProvider } from '../i18n'
import '../styles/base.css'

// Development only: entry of dashboard-preview.html, the shell as drawn in Figma (98:5) with its sample texts.
// ?role=staff shows the Staff view, ?lang=en shows English.
// The sample texts stand in for a real screen, which passes its own translated title and content.
const sample = {
  es: {
    title: 'Título de página',
    description: 'Descripción de la página',
    action: 'Acción principal',
    content: 'Contenido de la página',
  },
  en: { title: 'Page title', description: 'Page description', action: 'Main action', content: 'Page content' },
}

const params = new URLSearchParams(window.location.search)
const role = params.get('role') === 'staff' ? 'staff' : 'admin'
const lang = params.get('lang') === 'en' ? 'en' : 'es'
const texts = sample[lang]

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider locale={lang}>
      <DashboardShell
        account={{ name: 'Lorena Ortiz', role }}
        onSignOut={() => {}}
        title={texts.title}
        description={texts.description}
        action={<Button style={{ width: 216 }}>{texts.action}</Button>}
      >
        <p style={{ margin: 0, color: 'var(--muted-foreground)', fontSize: 15, lineHeight: '22px' }}>
          {texts.content}
        </p>
      </DashboardShell>
    </I18nProvider>
  </StrictMode>,
)
