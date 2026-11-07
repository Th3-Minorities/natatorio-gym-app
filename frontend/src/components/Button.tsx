import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: green; secondary: outlined, like "Cancelar"; link: text only, like "¿Olvidaste tu contraseña?" */
  variant?: 'primary' | 'secondary' | 'link'
  /** large is the 52px button of full-width forms, like N-11 */
  size?: 'default' | 'large'
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'default',
  fullWidth = false,
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  const classes = [
    'button',
    `button--${variant}`,
    size === 'large' && 'button--large',
    fullWidth && 'button--full',
    className,
  ].filter(Boolean)

  return <button type={type} className={classes.join(' ')} {...rest} />
}
