import type { ReactNode } from 'react'

/**
 * The boxed message inside a form, like "No pudimos iniciar sesión" on N-11. Read out when it appears.
 * tone="error" is the pink banner Figma draws for errors (N-11 4039:3904, A-05 4745:2133).
 */
export function Notice({ title, children, tone }: { title: string; children?: ReactNode; tone?: 'error' }) {
  return (
    <div className={tone ? `notice notice--${tone}` : 'notice'} role="alert">
      <p className="notice__title">{title}</p>
      {children && <p className="notice__text">{children}</p>}
    </div>
  )
}
