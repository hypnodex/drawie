import { useEffect, useState } from 'react'

/**
 * Minimal data-fetch hook for the Supabase-backed services. Runs `fn` on mount
 * and whenever `deps` change, tracking loading/error and supporting reload().
 * Stale results are ignored if deps change before a request resolves.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  initial: T,
): { data: T; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    fn()
      .then((d) => { if (active) { setData(d); setError(null) } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, loading, error, reload: () => setNonce((n) => n + 1) }
}
