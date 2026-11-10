import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { Button, EmptyState, ErrorState, LoadingState, Notice, OfflineState, TextField } from './index'

// Shared pieces drawn in Figma (MOCKUPS-GYM): N-11 4039:3871, A-08 107:1814, 132:3759, 132:3777,
// 107:1884, 107:1898, A-15 100:1205. The User app reuses them (#14).

describe('Button', () => {
  it('is a real button that does not submit forms by accident', () => {
    render(<Button>Guardar</Button>)

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveAttribute('type', 'button')
  })

  it('can submit a form when asked', () => {
    render(<Button type="submit">Iniciar sesión</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('has the primary, secondary and link looks from Figma', () => {
    render(
      <>
        <Button>Primario</Button>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="link">¿Olvidaste tu contraseña?</Button>
      </>,
    )

    expect(screen.getByRole('button', { name: 'Primario' })).toHaveClass('button', 'button--primary')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass('button--secondary')
    expect(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' })).toHaveClass('button--link')
  })

  it('does nothing when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Guardar
      </Button>,
    )

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByRole('button')).toBeDisabled()
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('TextField', () => {
  it('ties its label to the field, for screen readers and clicks', () => {
    render(<TextField label="Correo electrónico" type="email" />)

    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email')
  })

  it('marks the field invalid and reads the error with it', () => {
    render(<TextField label="Motivo obligatorio" error="Escribe un motivo de al menos 10 caracteres." />)

    const field = screen.getByLabelText('Motivo obligatorio')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Escribe un motivo de al menos 10 caracteres.')
  })

  it('is not marked invalid without an error', () => {
    render(<TextField label="Correo electrónico" />)

    expect(screen.getByLabelText('Correo electrónico')).not.toHaveAttribute('aria-invalid')
  })

  it('keeps the caller description and the error link, even with caller aria props', () => {
    const { rerender } = render(
      <>
        <p id="hint">Use your work email.</p>
        <TextField id="email" label="Email" error="Required." aria-describedby="hint" aria-invalid={false} />
      </>,
    )

    const field = screen.getByLabelText('Email')
    expect(field).toHaveAttribute('aria-describedby', 'hint email-error')
    expect(field).toHaveAccessibleDescription('Use your work email. Required.')
    expect(field).toHaveAttribute('aria-invalid', 'true')

    rerender(<TextField id="email" label="Email" aria-describedby="hint" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'hint')
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid')
  })

  it('passes typing through', () => {
    const onChange = vi.fn()
    render(<TextField label="Contraseña" type="password" onChange={onChange} />)

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secreto' } })

    expect(onChange).toHaveBeenCalled()
  })
})

describe('Notice', () => {
  it('is announced to screen readers when it appears', () => {
    render(<Notice title="No pudimos iniciar sesión">Verifica tu correo y contraseña e intenta de nuevo.</Notice>)

    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos iniciar sesión')
    expect(screen.getByRole('alert')).toHaveTextContent('Verifica tu correo y contraseña e intenta de nuevo.')
  })

  it('is neutral by default and pink with tone="error" (E-188)', () => {
    const { rerender } = render(<Notice title="Intenta de nuevo a las 10:45">Espera.</Notice>)
    expect(screen.getByRole('alert')).not.toHaveClass('notice--error')

    rerender(<Notice tone="error" title="No pudimos iniciar sesión" />)
    expect(screen.getByRole('alert')).toHaveClass('notice', 'notice--error')
  })
})

describe('states', () => {
  it('loading is a status with the Figma title, in the account language', () => {
    const { unmount } = render(<LoadingState detail="Buscando cuentas…" />)
    expect(screen.getByRole('status')).toHaveTextContent(es.states.loading)
    expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('status')).toHaveTextContent('Buscando cuentas…')
    unmount()

    render(
      <I18nProvider locale="en">
        <LoadingState />
      </I18nProvider>,
    )
    expect(screen.getByRole('status')).toHaveTextContent(en.states.loading)
  })

  it('empty shows its title and what the screen says', () => {
    render(<EmptyState lead="No encontramos cuentas para “Lidia Solís”." detail="Revisa el nombre." />)

    expect(screen.getByRole('heading', { name: es.states.empty })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(es.states.empty)
    expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy')
    expect(screen.getByText('No encontramos cuentas para “Lidia Solís”.')).toBeInTheDocument()
  })

  it('error offers to try again', () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)

    expect(screen.getByRole('alert')).toHaveTextContent(es.states.errorTitle)
    expect(screen.getByRole('alert')).not.toHaveAttribute('aria-busy')
    expect(screen.getByRole('alert')).toHaveTextContent(es.states.errorDetail)
    expect(screen.getByRole('alert')).toHaveClass('state--error')
    fireEvent.click(screen.getByRole('button', { name: es.states.retry }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('no connection keeps the retry button but disabled, as in Figma', () => {
    render(<OfflineState detail="Última actualización a las 10:42." />)

    expect(screen.getByRole('heading', { name: es.states.offlineTitle })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(es.states.offlineTitle)
    expect(screen.getByRole('status')).not.toHaveAttribute('aria-busy')
    expect(screen.getByText(es.states.offlineLead)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: es.states.retry })).toBeDisabled()
  })

  it('enables retry only with a connection and a retry action', () => {
    const onRetry = vi.fn()
    const { rerender } = render(<OfflineState onRetry={onRetry} />)
    const retry = screen.getByRole('button', { name: es.states.retry })
    expect(retry).toBeDisabled()
    fireEvent.click(retry)
    expect(onRetry).not.toHaveBeenCalled()

    rerender(<OfflineState online />)
    expect(retry).toBeDisabled()

    rerender(<OfflineState online onRetry={onRetry} />)
    expect(retry).toBeEnabled()
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledOnce()

    rerender(<OfflineState online={false} onRetry={onRetry} />)
    expect(retry).toBeDisabled()
  })
})

describe('user text', () => {
  it('is always shown as text, never as HTML', () => {
    const text = '<img src=x onerror="alert(1)"><b>negrita</b>'
    render(
      <>
        <TextField label={text} error={text} />
        <Notice title={text}>{text}</Notice>
        <EmptyState lead={text} detail={text} />
      </>,
    )

    expect(document.querySelector('img, b')).toBeNull()
    expect(screen.getAllByText(text).length).toBeGreaterThanOrEqual(4)
  })
})
