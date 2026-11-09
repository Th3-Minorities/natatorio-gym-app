import { Notice } from '../components'
import type { ApiError } from '../api/client'
import { errorText, useMessages } from '../i18n'

/** An API refusal as a Notice. No connection says so, instead of the general "no se pudo procesar". */
export function ProblemNotice({ problem, tone }: { problem: ApiError | null; tone?: 'error' }) {
  const texts = useMessages()
  if (!problem) return null
  if (problem.code === 'offline') {
    return <Notice title={texts.signIn.offlineTitle}>{texts.states.offlineRetryText}</Notice>
  }
  return <Notice tone={tone} title={errorText(texts, problem.code, problem.status)} />
}
