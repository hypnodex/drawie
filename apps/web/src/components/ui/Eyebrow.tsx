import type { ReactNode } from 'react'

type Variant = 'default' | 'dot' | 'index'

interface Props {
  variant?: Variant
  className?: string
  children: ReactNode
}

/**
 * Small mono label used for inline meta and form-field captions.
 * Sentence case (no uppercase) — matches the Figtree-only design system.
 */
export function Eyebrow({ variant = 'default', className = '', children }: Props) {
  const base = 'font-mono text-[11px] font-semibold text-[var(--muted)]'

  if (variant === 'dot') {
    return (
      <span className={[base, 'inline-flex items-center', className].join(' ')}>
        <span className="inline-block w-[0.55em] h-[0.55em] mr-[0.65em] rounded-full bg-[var(--accent)]" />
        {children}
      </span>
    )
  }
  if (variant === 'index') {
    return (
      <span className={['font-mono text-[11px] text-[var(--muted)]', className].join(' ')}>
        {children}
      </span>
    )
  }
  return <span className={[base, className].join(' ')}>{children}</span>
}
