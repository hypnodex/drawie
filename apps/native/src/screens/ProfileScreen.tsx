import { useEffect, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import {
  getProfile, listCanvases, computeEntitlement, supabase, type User, type Canvas,
} from '@drawie/data'
import { CanvasCard } from '../ui/CanvasCard'

/**
 * Profile / my-canvases — the signed-in user's stats, the canvases they've contributed to, and the
 * ones they've saved. Mirrors web UserProfileScreen: getProfile gives the id lists, then we filter
 * the public canvas list by them (private contributions aren't listed publicly, same as web).
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
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}><Text style={styles.back}>‹ Canvases</Text></Pressable>
        <Text style={styles.htitle}>Profile</Text>
        <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8}><Text style={styles.signOut}>Sign out</Text></Pressable>
      </View>

      {user === undefined && !error ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c8cff" /></View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.idRow}>
            <View style={[styles.avatar, { backgroundColor: user?.avatar || '#7c8cff' }]}>
              <Text style={styles.avatarText}>{(user?.name?.[0] ?? '?').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{user?.name ?? 'You'}</Text>
              {user?.isPremium && <Text style={styles.premium}>★ Premium</Text>}
              {ent && (
                <Text style={styles.ent}>
                  {ent.canCreateCanvas
                    ? 'Can found canvases ✓'
                    : `Found a canvas: ${ent.remainingTilesToFound} tile${ent.remainingTilesToFound === 1 ? '' : 's'} to go`}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.stats}>
            <Stat n={user?.completedTilesCount ?? 0} label="tiles" />
            <Stat n={contributed.length} label="canvases" />
            <Stat n={finished} label="finished" />
          </View>

          <Section title="Contributed">
            {contributed.length === 0
              ? <Text style={styles.empty}>No contributions yet — claim a tile to get started.</Text>
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
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  )
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 90 },
  htitle: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  signOut: { fontSize: 13, color: '#888', fontWeight: '600', width: 90, textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#ef476f', fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#7c8cff' },
  retryText: { color: '#fff', fontWeight: '700' },
  scroll: { padding: 16, gap: 18, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: '#fff' },
  name: { fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  premium: { fontSize: 12, color: '#f0a500', fontWeight: '700', marginTop: 2 },
  ent: { fontSize: 12, color: '#888', marginTop: 2 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: '#fafafc', borderWidth: 1, borderColor: '#ececf0', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  statN: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  statL: { fontSize: 12, color: '#999', marginTop: 2 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a2e' },
  empty: { color: '#999', fontSize: 13 },
})
