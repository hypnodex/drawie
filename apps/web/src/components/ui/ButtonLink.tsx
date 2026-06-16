import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'link'
type Size = 'sm' | 'md' | 'lg'

// Map the project's HeroUI-era variant/size names onto shadcn's buttonVariants so callers don't change.
const VARIANT_MAP: Record<Variant, NonNullable<Parameters<typeof buttonVariants>[0]>['variant']> = {
  primary: 'default',
  secondary: 'secondary',
  tertiary: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
  link: 'link',
}
const SIZE_MAP: Record<Size, NonNullable<Parameters<typeof buttonVariants>[0]>['size']> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
}

interface Props extends Omit<RouterLinkProps, 'className'> {
  variant?: Variant
  size?: Size
  isIconOnly?: boolean
  fullWidth?: boolean
  className?: string
}

/**
 * react-router-dom Link wearing shadcn Button styles — for in-app navigation where we want
 * middle-click / cmd-click semantics (a real <a>, not a <button>). (Phase 2: was HeroUI
 * buttonVariants; now shadcn buttonVariants via the variant/size map above.)
 */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  isIconOnly,
  fullWidth,
  className = '',
  ...rest
}: Props) {
  return (
    <RouterLink
      className={cn(
        buttonVariants({ variant: VARIANT_MAP[variant], size: isIconOnly ? 'icon' : SIZE_MAP[size] }),
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  )
}
