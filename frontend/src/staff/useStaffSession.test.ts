import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { endedSignIn } from './useStaffSession'

describe('endedSignIn', () => {
  it('gives the reason for the codes that end a staff sign-in', () => {
    expect(endedSignIn(new ApiError('staff_session_expired', 401))).toBe('timeout')
    expect(endedSignIn(new ApiError('staff_account_deactivated', 401))).toBe('deactivated')
    expect(endedSignIn(new ApiError('unauthenticated', 401))).toBeNull()
  })

  it('ignores every other code, including names every object has', () => {
    for (const code of ['forbidden', 'offline', 'constructor', 'toString', '__proto__']) {
      expect(endedSignIn(new ApiError(code, 401))).toBeUndefined()
    }
  })

  it('ignores errors that are not from the API', () => {
    expect(endedSignIn(new Error('boom'))).toBeUndefined()
  })
})
