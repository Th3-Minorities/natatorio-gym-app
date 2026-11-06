import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '../i18n'
import '../styles/base.css'
import { ComponentPreview } from './ComponentPreview'

// Development only: entry of component-preview.html. Add ?lang=en to the address to see English.
const locale = new URLSearchParams(window.location.search).get('lang') ?? undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider locale={locale}>
      <ComponentPreview />
    </I18nProvider>
  </StrictMode>,
)
