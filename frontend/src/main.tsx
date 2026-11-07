import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { UserEntry } from './user/UserApp'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './i18n'
import { StaffApp } from './staff/StaffApp'
import { isStaffPath } from './staff/staffPath'
import './styles/base.css'

// Spanish until a signed-in account says otherwise (E-64, E-114).
// The staff dashboard has its own address, /staff, with no link from the User side (E-124).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        {isStaffPath(window.location.pathname) ? (
          <StaffApp />
        ) : (
          <UserEntry>
            <App />
          </UserEntry>
        )}
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
