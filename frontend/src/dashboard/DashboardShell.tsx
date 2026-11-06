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
import './dashboard.css'

// Figma MOCKUPS-GYM, "Dashboard / Shell" (98:5): "Swap Content slot for screen content; override page title,
// description and action. Sidebar is shared."

export type StaffAccount = { name: string; role: 'staff' | 'admin' }

type Item = { label: string; icon: LucideIcon; accent?: boolean; strokeWidth?: number }

/** Icons as drawn: 18px, line 1.5 (2 for Información and Cuentas del staff), orange only for the first two. */
function NavIcon({ icon: Icon, accent, strokeWidth = 1.5 }: Omit<Item, 'label'>) {
  return <Icon size={18} strokeWidth={strokeWidth} className={accent ? 'nav__icon nav__icon--accent' : 'nav__icon'} />
}

function NavSection({ label, items, admin = false }: { label: string; items: Item[]; admin?: boolean }) {
  const labelId = useId()
  return (
    <div className={admin ? 'nav__section nav__section--admin' : 'nav__section'}>
      <p className="nav__label" id={labelId}>
        {label}
      </p>
      <ul className="nav__list" aria-labelledby={labelId}>
        {items.map(({ label: text, ...icon }) => (
          // Plain text until the issue that builds the screen connects it (#97: no pages beyond Figma).
          <li key={text}>
            <span className="nav__item">
              <NavIcon {...icon} />
              {text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type DashboardShellProps = {
  account: StaffAccount
  onSignOut: () => void
  title: string
  description?: string
  /** The page's main button, top right. */
  action?: ReactNode
  children: ReactNode
}

export function DashboardShell({ account, onSignOut, title, description, action, children }: DashboardShellProps) {
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
        <div className="brand">
          <p className="brand__campus">{texts.brandCampus}</p>
          <p className="brand__name">{texts.brandName}</p>
          <span className="brand__accent" aria-hidden="true" />
        </div>

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
              label={texts.adminSection}
              items={[
                { label: admin.terms, icon: Calendar },
                { label: admin.manageAthletes, icon: ClipboardList },
                { label: admin.storeSync, icon: RefreshCw },
                { label: admin.accounts, icon: UserCog },
                { label: admin.staffAccounts, icon: ShieldCheck, strokeWidth: 2 },
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
        <div className="page__top">
          <div className="page__heading">
            <h1 className="page__title">{title}</h1>
            {description && <p className="page__description">{description}</p>}
          </div>
          {action && <div className="page__action">{action}</div>}
        </div>
        <div className="page__content">{children}</div>
      </main>
    </div>
  )
}
