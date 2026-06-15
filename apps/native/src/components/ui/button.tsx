import * as React from 'react'
import { Pressable } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/cn'
import { TextClassContext } from './text'

/**
 * RN Reusables-style Button — the native twin of the web shadcn Button. Pressable + cva
 * variants over the shadcn token classes; child <Text> inherits the right color/size via
 * TextClassContext. Variants/sizes mirror the web button so screens map 1:1.
 */
const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary active:opacity-90',
        secondary: 'bg-secondary active:opacity-80',
        outline: 'border border-input bg-background active:bg-accent',
        ghost: 'active:bg-accent',
        destructive: 'bg-destructive active:opacity-90',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3',
        lg: 'h-12 px-6',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

const buttonTextVariants = cva('font-semibold', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      outline: 'text-foreground',
      ghost: 'text-foreground',
      destructive: 'text-destructive-foreground',
    },
    size: {
      default: 'text-sm',
      sm: 'text-xs',
      lg: 'text-base',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

type ButtonProps = React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants>

function Button({ className, variant, size, disabled, ...props }: ButtonProps) {
  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Pressable
        role="button"
        disabled={disabled}
        className={cn(buttonVariants({ variant, size }), disabled && 'opacity-50', className)}
        {...props}
      />
    </TextClassContext.Provider>
  )
}

export { Button, buttonVariants, buttonTextVariants }
