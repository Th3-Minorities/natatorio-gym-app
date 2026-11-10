import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { I18nProvider } from '../i18n'
import { es } from '../i18n/es'
import { ProblemNotice } from './ProblemNotice'

function show(problem: ApiError, tone?: 'error') {
  render(
    <I18nProvider locale="es">
      <ProblemNotice problem={problem} tone={tone} />
    </I18nProvider>,
  )
}

describe('ProblemNotice', () => {
  it('is the pink error notice when the caller says so (E-188)', () => {
    show(new ApiError('server_error', 500), 'error')

    expect(screen.getByRole('alert')).toHaveTextContent(es.errors.server_error)
    expect(screen.getByRole('alert')).toHaveClass('notice--error')
  })

  it('keeps no connection neutral, even for a caller that asks for error', () => {
    show(new ApiError('offline', 0), 'error')

    expect(screen.getByRole('alert')).toHaveTextContent(es.signIn.offlineTitle)
    expect(screen.getByRole('alert')).not.toHaveClass('notice--error')
  })
})
