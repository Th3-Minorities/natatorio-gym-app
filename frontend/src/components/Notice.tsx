import type { ReactNode } from 'react'

/** The boxed message inside a form, like "No pudimos iniciar sesión" on N-11. Read out when it appears. */
export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="notice" role="alert">
      <p className="notice__title">{title}</p>
      {children && <p className="notice__text">{children}</p>}
    </div>
  )
}
