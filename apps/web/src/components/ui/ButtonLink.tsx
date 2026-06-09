import { Link as RouterLink, type LinkProps as RouterLinkProps } from 'react-router-dom'
import { buttonVariants, type ButtonVariants } from '@heroui/react'

interface Props extends Omit<RouterLinkProps, 'className'> {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  isIconOnly?: boolean
  fullWidth?: boolean
  className?: string
}

/**
 * react-router-dom Link wearing HeroUI v3 Button styles. HeroUI's Button
 * component is a real <button> with `onPress` only, so for in-app navigation
 * (where we want middle-click / cmd-click semantics) we render a router
 * `<RouterLink>` and apply Button styles via `buttonVariants`.
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
      className={buttonVariants({ variant, size, isIconOnly, fullWidth, className })}
      {...rest}
    />
  )
}
