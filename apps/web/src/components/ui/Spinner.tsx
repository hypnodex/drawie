import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

type SpinnerSize = 'sm' | 'md' | 'lg'

const SIZE: Record<SpinnerSize, string> = { sm: 'size-4', md: 'size-5', lg: 'size-6' }

/** Loading spinner — Phase 2 drop-in for HeroUI's Spinner (lucide Loader2 + animate-spin). */
function Spinner({ size = 'md', className }: { size?: SpinnerSize; className?: string }) {
  return <Loader2 className={cn(SIZE[size], 'animate-spin', className)} aria-label="Loading" />
}

export { Spinner }
