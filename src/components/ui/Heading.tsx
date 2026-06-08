import { Typography } from '@heroui/react'
import type { ReactNode } from 'react'

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

const SIZE: Record<Size, string> = {
  xs:  'text-xl sm:text-2xl',
  sm:  'text-2xl sm:text-3xl',
  md:  'text-3xl sm:text-4xl',
  lg:  'text-4xl sm:text-5xl',
  xl:  'text-5xl sm:text-6xl',
  '2xl': 'text-6xl sm:text-7xl',
  '3xl': 'text-7xl sm:text-8xl',
}

interface Props {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  size?: Size
  className?: string
  children: ReactNode
}

/**
 * Editorial display heading — HeroUI Typography.Heading with project tracking
 * + Figtree weight. Pass `level={2}` for an h2 etc. Visual size is independent
 * via the `size` prop.
 */
export function Heading({ level = 1, size = 'lg', className = '', children }: Props) {
  return (
    <Typography.Heading
      level={level}
      className={[
        'font-display font-extrabold tracking-tight leading-[0.96] text-[var(--foreground)]',
        SIZE[size],
        className,
      ].join(' ')}
    >
      {children}
    </Typography.Heading>
  )
}
