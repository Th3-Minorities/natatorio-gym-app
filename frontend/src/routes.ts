import type { Account } from './account'
import type { TextKey } from './i18n'

type Access = 'public' | 'user' | 'account' | 'staff' | 'admin'
type Route = { path: string; id: TextKey; access: Access }

export const routes: Route[] = [
  { path: '/', id: 'N-01', access: 'public' },
  { path: '/sign-in', id: 'N-02', access: 'public' },
  { path: '/register/member', id: 'N-03', access: 'public' },
  { path: '/register/athlete', id: 'N-04', access: 'public' },
  { path: '/athlete-link', id: 'N-05', access: 'public' },
  { path: '/forgot-password', id: 'N-06', access: 'public' },
  { path: '/reset-password', id: 'N-07', access: 'public' },
  { path: '/privacy', id: 'N-08', access: 'public' },
  { path: '/install', id: 'N-09', access: 'public' },
  { path: '/dashboard/sign-in', id: 'N-11', access: 'public' },
  { path: '/app', id: 'U-01', access: 'user' },
  { path: '/app/photo', id: 'U-02', access: 'user' },
  { path: '/app/account', id: 'U-03', access: 'user' },
  { path: '/app/emergency-contact', id: 'U-04', access: 'user' },
  { path: '/app/delete-account', id: 'U-05', access: 'user' },
  { path: '/app/athlete', id: 'U-06', access: 'user' },
  { path: '/app/no-authorization', id: 'U-07', access: 'user' },
  { path: '/app/renew', id: 'U-08', access: 'user' },
  { path: '/app/visits', id: 'U-09', access: 'user' },
  { path: '/schedules', id: 'C-02', access: 'public' },
  { path: '/notices', id: 'C-03', access: 'public' },
  { path: '/information', id: 'C-04', access: 'account' },
  { path: '/analytics', id: 'C-05', access: 'account' },
  { path: '/dashboard', id: 'S-01', access: 'staff' },
  { path: '/dashboard/person', id: 'S-02', access: 'staff' },
  { path: '/dashboard/lookup', id: 'S-03', access: 'staff' },
  { path: '/dashboard/roster', id: 'S-05', access: 'staff' },
  { path: '/dashboard/schedules', id: 'C-02', access: 'staff' },
  { path: '/dashboard/notices', id: 'C-03', access: 'staff' },
  { path: '/dashboard/information', id: 'C-04', access: 'staff' },
  { path: '/dashboard/analytics', id: 'C-05', access: 'staff' },
  { path: '/dashboard/terms', id: 'A-04', access: 'admin' },
  { path: '/dashboard/athletes', id: 'A-05', access: 'admin' },
  { path: '/dashboard/store-sync', id: 'A-07', access: 'admin' },
  { path: '/dashboard/accounts', id: 'A-08', access: 'admin' },
  { path: '/dashboard/release-number', id: 'A-09', access: 'admin' },
  { path: '/dashboard/edit-schedules', id: 'A-10', access: 'admin' },
  { path: '/dashboard/edit-notices', id: 'A-11', access: 'admin' },
  { path: '/dashboard/edit-information', id: 'A-12', access: 'admin' },
  { path: '/dashboard/audit-log', id: 'A-13', access: 'admin' },
  { path: '/dashboard/staff', id: 'A-15', access: 'admin' },
  { path: '/dashboard/backups', id: 'A-16', access: 'admin' },
  { path: '/dashboard/manual-entries', id: 'A-17', access: 'admin' },
]

export function homePath(account: Account): string {
  if (account.role !== 'user') return '/dashboard'
  return routes.find((route) => route.id === (account.home ?? 'U-01'))!.path
}

export function canOpen(access: Access, account: Account | null): boolean {
  if (access === 'public') return true
  if (!account) return false
  if (access === 'account') return true
  if (access === 'staff') return account.role === 'staff' || account.role === 'admin'
  return account.role === access
}
