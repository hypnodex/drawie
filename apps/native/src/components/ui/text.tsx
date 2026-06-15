import * as React from 'react'
import { Text as RNText } from 'react-native'
import { cn } from '../../lib/cn'

/**
 * RN Reusables-style Text. A surrounding component (e.g. Button) can push default text
 * classes down via TextClassContext so children inherit the right color/size — the RN twin
 * of how shadcn buttons style their text. Defaults to the foreground token.
 */
const TextClassContext = React.createContext<string | undefined>(undefined)

function Text({ className, ...props }: React.ComponentProps<typeof RNText>) {
  const context = React.useContext(TextClassContext)
  return <RNText className={cn('text-base text-foreground', context, className)} {...props} />
}

export { Text, TextClassContext }
