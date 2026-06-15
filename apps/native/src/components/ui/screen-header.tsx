import * as React from 'react'
import { View, Pressable } from 'react-native'
import { Text } from './text'

/**
 * Shared screen header — a centered title with an optional back link and optional right slot, over
 * the shadcn tokens. Equal-width side slots keep the title centered. Reused across the native screens.
 */
export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Back',
  right,
}: {
  title: string
  onBack?: () => void
  backLabel?: string
  right?: React.ReactNode
}) {
  return (
    <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} className="w-24">
          <Text className="text-[15px] font-semibold text-primary">‹ {backLabel}</Text>
        </Pressable>
      ) : (
        <View className="w-24" />
      )}
      <Text className="text-[17px] font-bold text-foreground">{title}</Text>
      <View className="w-24 items-end">{right}</View>
    </View>
  )
}
