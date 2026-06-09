import { useCallback, useState } from 'react'
import { moderateContent, type ModerationInput } from '@drawie/data'

export type ModerationStatus = 'idle' | 'checking' | 'clean' | 'blocked' | 'error'

const ERROR_MESSAGE =
  "We couldn't check this canvas right now. Please try again in a moment."

/**
 * Wraps the moderation service with the loading / blocked / error state every
 * call site needs. `check()` resolves to `true` only when the content is clean,
 * so a caller can gate an action with a single `if (!(await check(...))) return`.
 *
 * The hook never throws and never mutates the user's work — gating is the
 * caller's responsibility, which keeps "don't delete on block" trivially true.
 */
export function useContentModeration() {
  const [status, setStatus] = useState<ModerationStatus>('idle')
  const [message, setMessage] = useState('')

  const check = useCallback(async (input: ModerationInput): Promise<boolean> => {
    setStatus('checking')
    setMessage('')
    try {
      const result = await moderateContent(input)
      if (result.allowed) {
        setStatus('clean')
        return true
      }
      setStatus('blocked')
      setMessage(result.message)
      return false
    } catch {
      setStatus('error')
      setMessage(ERROR_MESSAGE)
      return false
    }
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setMessage('')
  }, [])

  return {
    status,
    message,
    check,
    reset,
    isChecking: status === 'checking',
    /** True for both "inappropriate content" and "couldn't verify" outcomes. */
    isFlagged: status === 'blocked' || status === 'error',
  }
}
