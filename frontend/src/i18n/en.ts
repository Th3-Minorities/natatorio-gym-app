import type { Messages } from './es'

// English texts. Same keys as es.ts; TypeScript and i18n.test.tsx both check it.

export const en: Messages = {
  health: {
    waiting: 'Checking the API...',
    connected: 'API: connected',
    error: (code: string) => `API: error (${code})`,
    offline: 'API: no connection',
  },

  dates: { today: 'Today' },

  dashboard: {
    skipToContent: 'Skip to content',
    brandCampus: 'UPRM',
    brandName: 'Weight Gym',
    menu: 'Dashboard menu',
    staffSection: 'Staff',
    generalSection: 'General',
    adminSection: 'Administration',
    staffItems: {
      activeSessions: 'Active sessions',
      searchPerson: 'Find a person',
      athleteRoster: 'Athlete roster',
    },
    generalItems: {
      schedules: 'Schedules',
      notices: 'Notices',
      information: 'Information',
      statistics: 'Statistics',
    },
    adminItems: {
      terms: 'Terms',
      manageAthletes: 'Manage athletes',
      storeSync: 'Store sync',
      accounts: 'Accounts',
      staffAccounts: 'Staff accounts',
      backups: 'Backups',
      manualEntries: 'Manual entries',
      auditLog: 'Audit log',
    },
    roles: { staff: 'Staff', admin: 'Administrator' },
    signOut: 'Sign out',
  },

  states: {
    loading: 'Loading',
    empty: 'No results',
    errorTitle: 'Could not load',
    errorDetail: 'We could not load the data. Try again.',
    retry: 'Try again',
    offlineTitle: 'No connection',
    offlineLead: 'No connection. The data may have changed. Actions will be available when the connection is back.',
  },

  // The PWA owns the texts for stable API error codes (E-154).
  errors: {
    bad_request: 'The request could not be processed.',
    unauthenticated: 'Please sign in to continue.',
    forbidden: 'You do not have permission to do this.',
    not_found: 'We could not find what you were looking for.',
    method_not_allowed: 'This action is not allowed here.',
    conflict: 'This conflicts with the current data. Refresh and try again.',
    payload_too_large: 'The file or request is too large.',
    session_expired: 'Your session expired. Refresh the page and try again.',
    validation_failed: 'Some fields need to be fixed.',
    too_many_requests: 'Too many attempts. Wait a moment and try again.',
    service_unavailable: 'The service is not available right now. Try again later.',
    server_error: 'Something went wrong on our side. Try again later.',
    database_unavailable: 'The service is not available right now. Try again later.',
    staff_credentials_invalid: 'The email or password is not correct.',
    staff_session_expired: 'Your session ended after a while without activity. Sign in again.',
    staff_account_deactivated: 'This account was deactivated. Ask an Administrator if you need access again.',
  },

  validation: {
    required: 'This field is required.',
    email: 'Enter a valid email address.',
    min: 'The value is too short or too small.',
    max: 'The value is too long or too large.',
    string: 'Enter text.',
    in: 'Select a valid option.',
    unique: 'This value is already in use.',
    confirmed: 'The confirmation does not match.',
    invalid: 'Check this field.',
  },
}
