import { useEffect, useState } from 'react'
import { View, ScrollView, ActivityIndicator } from 'react-native'
import {
  getProfile, listCanvases, computeEntitlement, supabase, type User, type Canvas,
} from '@drawie/data'
import { CanvasCard } from '../ui/CanvasCard'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { ScreenHeader } from '../components/ui/screen-header'

const SPINNER = 'hsl(142, 71%, 45%)' // brand primary, for the standalone RN ActivityIndicator

/**
 * Profile / my-canvases — the signed-in user's stats, the canvases they've contributed to, and the
 * ones they've saved. Mirrors web UserProfileScreen.
 *
 * Phase 3 (native shadcn): StyleSheet → NativeWind + RN-Reusables primitives over the shadcn tokens.
 * (CanvasCard keeps its own styling for now — migrated in a later component pass.)
 */
export function ProfileScreen({ onBack, onOpen }: { onBack: () => void; onOpen: (canvasId: string) => void }) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [all, setAll] = useState<Canvas[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const { data: { user: au } } = await supabase.auth.getUser()
      const [profile, canvases] = await Promise.all([
        au ? getProfile(au.id) : Promise.resolve(null),
        listCanvases({}),
      ])
      setUser(profile)
      setAll(canvases)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setUser(null)
    }
  }
  useEffect(() => { void load() }, [])

  const contributed = user ? all.filter((c) => user.contributedCanvasIds.includes(c.id)) : []
  const saved = user ? all.filter((c) => user.savedCanvasIds.includes(c.id)) : []
  const finished = contributed.filter((c) => c.status === 'completed').length
  const ent = user ? computeEntitlement(user) : null

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Profile"
        onBack={onBack}
        backLabel="Canvases"
        right={
          <Button variant="ghost" size="sm" onPress={() => supabase.auth.signOut()} className="px-0">
            <Text className="text-[13px] font-semibold text-muted-foreground">Sign out</Text>
          </Button>
        }
      />

      {user === undefined && !error ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={SPINNER} /></View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-3 px-6">
          <Text className="text-center text-sm text-destructive">{error}</Text>
          <Button onPress={load}><Text>Retry</Text></Button>
        </View>
      ) : (
        <ScrollView contentContainerClassName="w-full max-w-[720px] gap-[18px] self-center p-4 pb-10">
          {/* identity */}
          <View className="flex-row items-center gap-3.5">
            <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: user?.avatar || '#22c55e' }}>
              <Text className="text-2xl font-extrabold text-white">{(user?.name?.[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View className="flex-1">
              <Text numberOfLines={1} className="text-xl font-extrabold text-foreground">{user?.name ?? 'You'}</Text>
              {user?.isPremium && <Text className="mt-0.5 text-xs font-bold text-primary">★ Premium</Text>}
              {ent && (
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  {ent.canCreateCanvas
                    ? 'Can found canvases ✓'
                    : `Found a canvas: ${ent.remainingTilesToFound} tile${ent.remainingTilesToFound === 1 ? '' : 's'} to go`}
                </Text>
              )}
            </View>
          </View>

          {/* stats */}
          <View className="flex-row gap-2.5">
            <Stat n={user?.completedTilesCount ?? 0} label="tiles" />
            <Stat n={contributed.length} label="canvases" />
            <Stat n={finished} label="finished" />
          </View>

          <Section title="Contributed">
            {contributed.length === 0
              ? <Text className="text-[13px] text-muted-foreground">No contributions yet — claim a tile to get started.</Text>
              : contributed.map((c) => <CanvasCard key={c.id} canvas={c} onPress={() => onOpen(c.id)} />)}
          </Section>

          {saved.length > 0 && (
            <Section title="Saved">
              {saved.map((c) => <CanvasCard key={c.id} canvas={c} onPress={() => onOpen(c.id)} />)}
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-border bg-muted py-3.5">
      <Text className="text-[22px] font-extrabold text-foreground">{n}</Text>
      <Text className="mt-0.5 text-xs text-muted-foreground">{label}</Text>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2.5">
      <Text className="text-[15px] font-bold text-foreground">{title}</Text>
      <View className="gap-3">{children}</View>
    </View>
  )
}
