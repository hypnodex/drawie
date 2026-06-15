import { useEffect, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { getHostId, getParticipants, kickParticipant, type PrivateParticipant } from '@drawie/data'

/**
 * Host console for a private canvas — lists everyone holding a tile (derived from the tiles table)
 * and lets the host remove a participant (host_kick, which frees their tile). Reachable from the
 * share screen, from the canvas when you're the host, or via the drawie://host?token=… deep link.
 * Reassign (host_reassign) is deferred — it needs a target picker and is a niche op.
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
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>Participants</Text>
        <View style={{ width: 60 }} />
      </View>

      {participants === null && !error ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c8cff" /></View>
      ) : error && !participants ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {!!error && <Text style={styles.errorInline}>{error}</Text>}
          <Text style={styles.count}>{drawing} {drawing === 1 ? 'artist' : 'artists'} · {participants!.length} on canvas</Text>
          {participants!.length === 0 && <Text style={styles.empty}>No one has joined yet. Share the guest link.</Text>}
          {participants!.map((p) => (
            <View key={p.id + p.tileId} style={styles.row}>
              <View style={[styles.dot, p.status === 'completed' ? styles.dotDone : p.status === 'in-progress' ? styles.dotActive : styles.dotIdle]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.name}{p.isHost ? '  · host' : ''}</Text>
                <Text style={styles.status}>{p.status}</Text>
              </View>
              {!p.isHost && (
                <Pressable onPress={() => remove(p)} disabled={!!acting} style={[styles.kick, acting === p.id && styles.kickBusy]}>
                  {acting === p.id ? <ActivityIndicator size="small" color="#ef476f" /> : <Text style={styles.kickText}>Remove</Text>}
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  error: { color: '#ef476f', fontSize: 13, paddingHorizontal: 24, textAlign: 'center' },
  errorInline: { color: '#ef476f', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  retry: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#7c8cff' },
  retryText: { color: '#fff', fontWeight: '700' },
  scroll: { padding: 16, gap: 4, maxWidth: 640, width: '100%', alignSelf: 'center' },
  count: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8 },
  empty: { color: '#999', textAlign: 'center', marginTop: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotDone: { backgroundColor: '#06d6a0' },
  dotActive: { backgroundColor: '#ffd166' },
  dotIdle: { backgroundColor: '#d0d0d8' },
  name: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },
  status: { fontSize: 12, color: '#999', marginTop: 1 },
  kick: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: '#f3c0cc', minWidth: 76, alignItems: 'center' },
  kickBusy: { opacity: 0.6 },
  kickText: { fontSize: 13, color: '#ef476f', fontWeight: '700' },
})
