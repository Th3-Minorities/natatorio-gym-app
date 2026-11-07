import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { formatDate } from '../format/dateTime'
import { I18nProvider } from '../i18n'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { ErrorBoundary } from './ErrorBoundary'

function BadDate() {
  return <p>{formatDate('invalid', 'es')}</p>
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test('renders children when they do not throw', () => {
  render(
    <ErrorBoundary>
      <p>Content</p>
    </ErrorBoundary>,
  )

  expect(screen.getByText('Content')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([['es', es], ['en', en]] as const)('shows a translated error for a bad date in %s', (locale, texts) => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const reload = vi.fn()
  vi.stubGlobal('location', { reload })
  render(
    <I18nProvider locale={locale}>
      <ErrorBoundary>
        <BadDate />
      </ErrorBoundary>
    </I18nProvider>,
  )

  expect(screen.getByRole('alert')).toHaveTextContent(texts.states.errorTitle)
  expect(screen.getByRole('alert')).toHaveTextContent(texts.states.errorDetail)
  expect(screen.getByRole('alert')).not.toHaveAttribute('aria-busy')
  fireEvent.click(screen.getByRole('button', { name: texts.states.retry }))
  expect(reload).toHaveBeenCalledOnce()
})
