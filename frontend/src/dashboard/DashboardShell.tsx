import {
  Activity,
  Calendar,
  ChartColumn,
  ClipboardList,
  Clock,
  Database,
  Info,
  LogOut,
  Megaphone,
  NotebookPen,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useMessages } from '../i18n'
import { Brand } from './Brand'
import './dashboard.css'

// Figma MOCKUPS-GYM, "Dashboard / Shell" (98:5): "Swap Content slot for screen content; override page title,
// description and action. Sidebar is shared."

export type StaffAccount = { name: string; role: 'staff' | 'admin' }

type Icon = { icon: LucideIcon; accent?: boolean; strokeWidth?: number }

type Item = Icon & { label: string; href?: string }

/** Moves between dashboard screens without reloading. Items with an href are links; the rest are plain text. */
export type DashboardNavigation = { currentPath: string; onNavigate: (path: string) => void; staffAccounts: string }

/** Icons as drawn: 18px, line 1.5 (2 for Información and Cuentas del staff), orange only for the first two. */
function NavIcon({ icon: Icon, accent, strokeWidth = 1.5 }: Icon) {
  return <Icon size={18} strokeWidth={strokeWidth} className={accent ? 'nav__icon nav__icon--accent' : 'nav__icon'} />
}

function NavLink({ label, href, icon, navigation }: { label: string; href: string; icon: Icon; navigation: DashboardNavigation }) {
  const current = navigation.currentPath === href
  return (
    <a
      className={current ? 'nav__item nav__item--link nav__item--current' : 'nav__item nav__item--link'}
      href={href}
      aria-current={current ? 'page' : undefined}
      onClick={(event) => {
        // Ctrl, Cmd, Shift or a middle click opens a new tab or window, as the browser would.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigation.onNavigate(href)
      }}
    >
      <NavIcon {...icon} />
      {label}
    </a>
  )
}

function NavSection({
  label,
  items,
  admin = false,
  navigation,
}: {
  label: string
  items: Item[]
  admin?: boolean
  navigation?: DashboardNavigation
}) {
  const labelId = useId()
  return (
    <div className={admin ? 'nav__section nav__section--admin' : 'nav__section'}>
      <p className="nav__label" id={labelId}>
        {label}
      </p>
      <ul className="nav__list" aria-labelledby={labelId}>
        {items.map(({ label: text, href, ...icon }) => (
          // Plain text until the issue that builds the screen connects it (#97: no pages beyond Figma).
          <li key={text}>
            {href && navigation ? (
              <NavLink label={text} href={href} icon={icon} navigation={navigation} />
            ) : (
              <span className="nav__item">
                <NavIcon {...icon} />
                {text}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

type DashboardShellProps = {
  account: StaffAccount
  onSignOut: () => void
  /** Without it, every menu item is plain text. */
  navigation?: DashboardNavigation
  /** Without a title (no screen built yet), the page still has a heading for screen readers, hidden on screen. */
  title?: string
  description?: string
  /** The page's main button, top right. */
  action?: ReactNode
  children: ReactNode
}

export function DashboardShell({
  account,
  onSignOut,
  navigation,
  title,
  description,
  action,
  children,
}: DashboardShellProps) {
  const texts = useMessages().dashboard
  const staff = texts.staffItems
  const general = texts.generalItems
  const admin = texts.adminItems

  return (
    <div className="shell">
      <a className="shell__skip" href="#dashboard-content">
        {texts.skipToContent}
      </a>

      <aside className="sidebar">
        <Brand />

        <nav className="nav" aria-label={texts.menu}>
          <NavSection
            label={texts.staffSection}
            items={[
              { label: staff.activeSessions, icon: Activity, accent: true },
              { label: staff.searchPerson, icon: Search, accent: true },
              { label: staff.athleteRoster, icon: Users },
            ]}
          />
          <NavSection
            label={texts.generalSection}
            items={[
              { label: general.schedules, icon: Clock },
              { label: general.notices, icon: Megaphone },
              { label: general.information, icon: Info, strokeWidth: 2 },
              { label: general.statistics, icon: ChartColumn },
            ]}
          />
          {/* Only Administrators see these (REQ-NF-10). The backend still checks every action (REQ-F-52). */}
          {account.role === 'admin' && (
            <NavSection
              admin
              navigation={navigation}
              label={texts.adminSection}
              items={[
                { label: admin.terms, icon: Calendar },
                { label: admin.manageAthletes, icon: ClipboardList },
                { label: admin.storeSync, icon: RefreshCw },
                { label: admin.accounts, icon: UserCog },
                { label: admin.staffAccounts, icon: ShieldCheck, strokeWidth: 2, href: navigation?.staffAccounts },
                { label: admin.backups, icon: Database },
                { label: admin.manualEntries, icon: NotebookPen },
                { label: admin.auditLog, icon: ScrollText },
              ]}
            />
          )}
        </nav>

        <div className="person">
          <p className="person__name">
            {account.name} · {texts.roles[account.role]}
          </p>
          <button type="button" className="person__sign-out" onClick={onSignOut}>
            <LogOut size={18} strokeWidth={1.5} className="nav__icon" />
            {texts.signOut}
          </button>
        </div>
      </aside>

      <main className="page" id="dashboard-content" tabIndex={-1}>
        {title ? (
          <div className="page__top">
            <div className="page__heading">
              <h1 className="page__title" tabIndex={-1}>
                {title}
              </h1>
              {description && <p className="page__description">{description}</p>}
            </div>
            {action && <div className="page__action">{action}</div>}
          </div>
        ) : (
          <h1 className="visually-hidden" tabIndex={-1}>
            {texts.brandName}
          </h1>
        )}
        <div className="page__content">{children}</div>
      </main>
    </div>
  )
}
