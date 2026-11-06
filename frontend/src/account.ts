export type Account = {
  role: 'user' | 'staff' | 'admin'
  locale?: string
  name?: string
  home?: 'U-01' | 'U-02' | 'U-07'
}

// Sign in supplies this account from the API. No device preference or mock authentication.
export function accountLocale(account: Account | null): 'es' | 'en' {
  return account?.locale === 'en' ? 'en' : 'es'
}
