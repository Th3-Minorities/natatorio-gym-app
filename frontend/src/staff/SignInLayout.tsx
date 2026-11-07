import type { ReactNode } from 'react'
import { Brand } from '../dashboard/Brand'
import './signIn.css'

/** The green header with the brand and the centered column of N-11 (Figma 4039:3721). */
export function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <div className="sign-in">
      <header className="sign-in__header">
        <div className="sign-in__column">
          <Brand inline />
        </div>
      </header>
      <main className="sign-in__main">
        <div className="sign-in__column">{children}</div>
      </main>
    </div>
  )
}
