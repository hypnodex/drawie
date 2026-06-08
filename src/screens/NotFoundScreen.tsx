import { useLocation } from 'react-router-dom'
import { ButtonLink } from '../components/ui/ButtonLink'
import { Heading } from '../components/ui/Heading'

export default function NotFoundScreen() {
  const loc = useLocation()
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <Heading level={1} size="xl">
          That mosaic
          <br />
          doesn't exist.
        </Heading>
        <p className="mt-5 text-sm text-[var(--muted)] leading-relaxed">
          Nothing's drawn at this path. The link might be stale or the canvas was removed.
        </p>
        <code className="inline-block mt-3 px-2 py-1 rounded bg-[var(--surface-secondary)] font-mono text-[12px] text-[var(--foreground)]">
          {loc.pathname}
        </code>
        <div className="mt-8 flex items-center justify-center gap-3">
          <ButtonLink to="/" variant="primary" size="lg">
            Back to discover <span aria-hidden>→</span>
          </ButtonLink>
          <ButtonLink to="/dashboard" variant="secondary" size="lg">
            Dashboard
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
