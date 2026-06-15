import * as React from 'react'
import { TextInput } from 'react-native'
import { cn } from '../../lib/cn'

/**
 * RN Reusables-style Input — the native twin of the web shadcn Input. A NativeWind-styled
 * TextInput over the shadcn token classes (border-input / bg-background / text-foreground).
 */
function Input({ className, placeholderClassName, ...props }: React.ComponentProps<typeof TextInput> & { placeholderClassName?: string }) {
  return (
    <TextInput
      className={cn(
        'h-11 rounded-md border border-input bg-background px-3 text-base text-foreground',
        props.editable === false && 'opacity-50',
        className,
      )}
      placeholderTextColor="hsl(var(--muted-foreground))"
      {...props}
    />
  )
}

export { Input }
