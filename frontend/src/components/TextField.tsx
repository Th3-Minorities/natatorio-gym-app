import { useId, type ComponentProps } from 'react'

// ComponentProps<'input'> includes `ref`, so a screen can move focus to the field (React 19 passes ref as a prop).
type TextFieldProps = ComponentProps<'input'> & {
  label: string
  /** Shown under the field and read with it by screen readers (WCAG 3.3.1). */
  error?: string
}

export function TextField({ label, error, id, className, 'aria-describedby': describedBy, ...rest }: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
      />
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}
