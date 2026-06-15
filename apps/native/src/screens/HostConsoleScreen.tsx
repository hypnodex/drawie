import { useEffect, useState } from 'react'
import { View, ScrollView, ActivityIndicator } from 'react-native'
import { getHostId, getParticipants, kickParticipant, type PrivateParticipant } from '@drawie/data'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { ScreenHeader } from '../components/ui/screen-header'
import { cn } from '../lib/cn'

const SPINNER = 'hsl(142, 71%, 45%)'
const DESTRUCTIVE = 'hsl(350, 80%, 55%)'

/**
 * Host console for a private canvas — lists everyone holding a tile and lets the host remove a
 * participant (host_kick, which frees their tile). Reachable from share, from the canvas when you're
 * the host, or via the drawie://host?token=… deep link.
 *
 * Phase 3 (native shadcn): StyleSheet → NativeWind + RN-Reusables primitives over the shadcn tokens.
 */
export function HostConsoleScreen({ canvasId, onBack }: { canvasId: string; onBack: () => void }) {
  const [participants, setParticipants] = useState<PrivateParticipant[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const hostId = await getHostId(canvasId)
      setParticipants(await getParticipants(canvasId, hostId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  useEffect(() => { void load() }, [canvasId])

  const remove = async (p: PrivateParticipant) => {
    if (p.isHost || acting) return
    setActing(p.id)
    setError(null)
    try {
      await kickParticipant(canvasId, p.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActing(null)
    }
  }

  const drawing = participants?.filter((p) => !p.isHost).length ?? 0

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Participants" onBack={onBack} />

      {participants === null && !error ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={SPINNER} /></View>
      ) : error && !participants ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-sm text-destructive">{error}</Text>
          <Button onPress={load}><Text>Retry</Text></Button>
        </View>
      ) : (
        <ScrollView contentContainerClassName="w-full max-w-[640px] gap-1 self-center p-4">
          {!!error && <Text className="mb-2 text-center text-sm text-destructive">{error}</Text>}
          <Text className="mb-2 text-[13px] font-semibold text-muted-foreground">
            {drawing} {drawing === 1 ? 'artist' : 'artists'} · {participants!.length} on canvas
          </Text>
          {participants!.length === 0 && <Text className="mt-8 text-center text-muted-foreground">No one has joined yet. Share the guest link.</Text>}
          {participants!.map((p) => (
            <View key={p.id + p.tileId} className="flex-row items-center gap-3 border-b border-border py-3">
              <View
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  p.status === 'completed' ? 'bg-emerald-500' : p.status === 'in-progress' ? 'bg-amber-400' : 'bg-muted-foreground/40',
                )}
              />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[15px] font-semibold text-foreground">{p.name}{p.isHost ? '  · host' : ''}</Text>
                <Text className="mt-px text-xs text-muted-foreground">{p.status}</Text>
              </View>
              {!p.isHost && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => remove(p)}
                  disabled={!!acting}
                  className="min-w-[76px] rounded-full border-destructive/40"
                >
                  {acting === p.id ? <ActivityIndicator size="small" color={DESTRUCTIVE} /> : <Text className="text-destructive">Remove</Text>}
                </Button>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}
