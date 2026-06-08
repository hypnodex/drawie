interface Props {
  steps: { id: string; label: string }[]
  current: number
  onJump?: (idx: number) => void
}

export function WizardStepper({ steps, current, onJump }: Props) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3 flex-wrap">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const jumpable = !!onJump && i <= current
        const bullet = [
          'inline-flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-bold transition',
          active
            ? 'bg-[var(--foreground)] text-[var(--background)]'
            : done
            ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
            : 'bg-[var(--surface-secondary)] text-[var(--muted)]',
        ].join(' ')
        return (
          <li key={s.id} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              disabled={!jumpable}
              onClick={() => onJump?.(i)}
              className="flex items-center gap-2 disabled:cursor-default"
            >
              <span className={bullet}>
                {done ? (
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l4.5 4.5L20 6" />
                  </svg>
                ) : i + 1}
              </span>
              <span className={[
                'text-[11px] font-bold transition',
                active ? 'text-[var(--foreground)]' : done ? 'text-[var(--muted)]' : 'text-[var(--muted)]',
              ].join(' ')}>
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span className={[
                'hidden sm:inline-block h-px w-6',
                done ? 'bg-[var(--accent)]' : 'bg-[var(--surface-secondary)]',
              ].join(' ')} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
