import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, MouseEvent } from 'react'
import { ChartColumn, CalendarDays, ClipboardList, Dumbbell, House, Info, Menu, Megaphone,
  Search, Settings, Users, WifiOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { accountLocale } from './account'
import type { Account } from './account'
import { Button, EmptyState, ErrorState } from './components'
import { Install } from './Install'
import { errorText, messages } from './i18n'
import type { TextKey } from './i18n'
import { canOpen, homePath, routes } from './routes'
import { useConnection } from './useConnection'

function navigate(path: string, replace = false) {
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function Link({ href, disabled, children, ...props }: ComponentProps<'a'> & { disabled?: boolean }) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (disabled) { event.preventDefault(); return }
    if (!href || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
  }
  return <a {...props} href={href} aria-disabled={disabled || undefined} onClick={follow}>{children}</a>
}

type NavItem = { path: string; label: TextKey; icon: LucideIcon }

export default function App({ account = null }: { account?: Account | null }) {
  // This is the only account input. Sign in will pass the API account here.
  const locale = accountLocale(account)
  const t = messages[locale]
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/$/, '') || '/')
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(path)
  const { health, retry } = useConnection()
  const offline = health.kind === 'offline'
  const dashboard = account?.role === 'staff' || account?.role === 'admin' || path.startsWith('/dashboard')
  const userApp = account?.role === 'user'
  const route = routes.find((item) => item.path === path)
  const more = path === '/app/more' && userApp
  const diagnostic = path === '/estado-api'
  const allowed = diagnostic || more || !!route && canOpen(route.access, account)
  const title = diagnostic ? t.healthTitle : more ? t.more : !route ? t.notFoundTitle : !allowed ? t.forbiddenTitle : t[route.id]

  useEffect(() => {
    const update = () => setPath(window.location.pathname.replace(/\/$/, '') || '/')
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  useEffect(() => {
    if (account && ['/', '/sign-in', '/dashboard/sign-in'].includes(path)) {
      navigate(homePath(account), true)
    } else if (!account && route && route.access !== 'public') {
      navigate(dashboard ? '/dashboard/sign-in' : '/sign-in', true)
    } else if (!account && path === '/app/more') {
      navigate('/sign-in', true)
    }
  }, [account, path, route, dashboard])

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = `${title} | ${t.appName}`
    if (path !== previousPath.current) {
      main.current?.focus()
      previousPath.current = path
    }
  }, [locale, title, t.appName, path])

  const userItems: NavItem[] = [
    { path: account ? homePath(account) : '/app', label: 'home', icon: House },
    { path: '/schedules', label: 'hours', icon: CalendarDays },
    { path: '/notices', label: 'notices', icon: Megaphone },
    { path: '/analytics', label: 'stats', icon: ChartColumn },
    { path: '/app/more', label: 'more', icon: Menu },
  ]
  const staffItems: NavItem[] = [
    { path: '/dashboard', label: 'S-01', icon: House },
    { path: '/dashboard/lookup', label: 'S-03', icon: Search },
    { path: '/dashboard/roster', label: 'S-05', icon: Users },
    { path: '/dashboard/schedules', label: 'C-02', icon: CalendarDays },
    { path: '/dashboard/notices', label: 'C-03', icon: Megaphone },
    { path: '/dashboard/information', label: 'C-04', icon: Info },
    { path: '/dashboard/analytics', label: 'C-05', icon: ChartColumn },
  ]
  const morePaths = ['/information', '/app/account', '/install', '/privacy']
  const items = userApp ? userItems : dashboard && account ? staffItems : []
  const moreSelected = more || path.startsWith('/app/') && path !== homePath(account ?? { role: 'user' })
    || morePaths.includes(path)

  function links(paths: string[]) {
    return <ul className="page-links">{paths.map((url) => {
      const item = routes.find((candidate) => candidate.path === url)!
      return <li key={url}><Link href={url}>{t[item.id]}</Link></li>
    })}</ul>
  }

  return <div className={`app-shell ${userApp ? 'user-shell' : dashboard && account ? 'dashboard-shell' : 'public-shell'}`}>
    <a className="skip-link" href="#main">{t.skip}</a>
    <header className="app-header">
      <Link className="brand" href={account ? homePath(account) : dashboard ? '/dashboard/sign-in' : '/'}>
        <Dumbbell aria-hidden="true" /><span><strong>{t.brand}</strong><small>{t.brandSubtitle}</small></span>
      </Link>
    </header>
    {items.length > 0 && <nav className={`main-nav ${userApp ? 'user-nav' : 'staff-nav'}`} aria-label={t.navigation}>
      <ul>{items.map(({ path: url, label, icon: Icon }) => {
        const active = url === path || label === 'more' && moreSelected
        return <li key={url}><Link href={url} aria-current={active ? 'page' : undefined}>
          <Icon aria-hidden="true" /><span>{t[label]}</span>
        </Link></li>
      })}</ul>
      {account?.role === 'admin' && <>
        <h2>{t.administration}</h2>
        <ul>{routes.filter((item) => item.access === 'admin').map((item) => <li key={item.path}>
          <Link href={item.path} aria-current={path === item.path ? 'page' : undefined}>
            <Settings aria-hidden="true" /><span>{t[item.id]}</span>
          </Link>
        </li>)}</ul>
      </>}
      {dashboard && account && <p className="account-label">{account.name && <span>{account.name}</span>}{t[account.role]}</p>}
    </nav>}
    <div className="workspace">
      {offline && <div className="offline-banner" role="alert"><WifiOff aria-hidden="true" /><span>{t.offline}</span>
        <Button onClick={retry}>{t.retry}</Button>
      </div>}
      <main id="main" tabIndex={-1} ref={main}>
        {route && allowed && <p className="screen-id">{route.id}</p>}
        <h1>{title}</h1>
        {!allowed && !more && <ErrorState message={route ? t.forbidden : t.not_found} />}
        {allowed && !more && route && !['N-01', 'N-09'].includes(route.id) && <EmptyState message={t.placeholder} />}
        {route?.id === 'N-01' && <>
          <ul className="page-links landing-actions">
            {['/sign-in', '/register/member', '/register/athlete'].map((url) => {
              const item = routes.find((candidate) => candidate.path === url)!
              return <li key={url}><Link href={url} disabled={offline}>{t[item.id]}</Link></li>
            })}
          </ul>
          {links(['/schedules', '/notices', '/privacy', '/install'])}
        </>}
        {more && links(morePaths)}
        {allowed && route?.id === 'U-03' && links(['/app/emergency-contact', '/app/visits', '/app/delete-account',
          ...(account?.home === 'U-07' ? ['/app/athlete', '/app/renew'] : [])])}
        {allowed && route?.id === 'N-02' && links(['/forgot-password'])}
        {allowed && route?.id === 'S-01' && links(['/dashboard/person'])}
        <Install locale={locale} help={route?.id === 'N-09'} show={route?.id === 'N-01' || route?.id === 'N-09'} />
      </main>
      {(diagnostic || health.kind === 'error') && <footer className="health-status">
        {diagnostic && <><ClipboardList aria-hidden="true" />
        <p role="status">{health.kind === 'waiting' ? t.healthWaiting
          : health.kind === 'connected' ? t.healthConnected
            : health.kind === 'offline' ? t.healthOffline : t.healthError}</p></>}
        {health.kind === 'error' && <ErrorState message={errorText(health.code, locale)} retryLabel={t.retry} onRetry={retry} />}
      </footer>}
    </div>
  </div>
}
