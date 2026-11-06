import { useId } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react'
import { CircleExclamationPoint, Inbox, LoaderCircle } from 'lucide-react'

export function Button({ type = 'button', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`button ${className}`} {...props} />
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }

export function FormField({ label, error, id, 'aria-describedby': describedBy, ...props }: FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const errorId = `${fieldId}-error`
  return <div className="form-field">
    <label htmlFor={fieldId}>{label}</label>
    <input {...props} id={fieldId} aria-invalid={error ? true : undefined}
      aria-describedby={[describedBy, error ? errorId : null].filter(Boolean).join(' ') || undefined} />
    {error && <p id={errorId} role="alert">{error}</p>}
  </div>
}

export function EmptyState({ message }: { message: string }) {
  return <p className="state" role="status"><Inbox aria-hidden="true" />{message}</p>
}

export function LoadingState({ message }: { message: string }) {
  return <p className="state" role="status"><LoaderCircle aria-hidden="true" />{message}</p>
}

export function ErrorState({ message, retryLabel, onRetry }: {
  message: string; retryLabel?: string; onRetry?: () => void
}) {
  return <div className="state"><p role="alert"><CircleExclamationPoint aria-hidden="true" />{message}</p>
    {onRetry && retryLabel && <Button onClick={onRetry}>{retryLabel}</Button>}
  </div>
}
