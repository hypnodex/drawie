import { Component, type ReactNode } from 'react'
import { Button } from './button'
import { Surface } from './Surface'
import { Eyebrow } from './Eyebrow'
import { Heading } from './Heading'

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Drawie ErrorBoundary caught:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)] text-[var(--foreground)]">
        <Surface variant="secondary" className="max-w-md w-full rounded-[var(--radius)] p-7 text-center">
          <Eyebrow variant="dot" className="!text-[var(--danger)]">Error · 500</Eyebrow>
          <Heading level={1} size="md" className="mt-3">
            We hit an unexpected error.
          </Heading>
          <p className="mt-3 text-sm text-[var(--muted)]">
            The drawing engine and your saved work are unaffected. Reload to recover.
          </p>
          <pre className="mt-4 p-3 rounded-xl bg-[var(--surface)] text-[11px] font-mono text-[var(--muted)] text-left whitespace-pre-wrap overflow-auto max-h-40">
{String(this.state.error?.message ?? this.state.error)}
          </pre>
          <Button
            onClick={() => window.location.assign('/')}
            className="mt-5 text-sm"
          >
            Reload
          </Button>
        </Surface>
      </div>
    )
  }
}
