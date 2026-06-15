import { StyleSheet, View, Text, Pressable, ScrollView, Share } from 'react-native'
import { buildGuestLink, buildHostLink, type Canvas } from '@drawie/data'

// Web origin for shareable invite links (opens the web join flow; also pasteable into the native
// Join screen as a token). The hosted deployment — keep in sync with the Vercel domain.
const WEB_ORIGIN = 'https://drawie-xi.vercel.app'

/**
 * Invite screen shown after founding a PRIVATE canvas. Surfaces the guest link to share with
 * participants (RN share sheet — includes Copy) and the raw guest code for pasting into the native
 * Join screen. The host link is shown but de-emphasised (control link, keep private). Host console
 * (participants / kick / reassign) is a later increment.
 */
export function ShareScreen({ canvas, onOpen, onManage, onBack }: { canvas: Canvas; onOpen: (id: string) => void; onManage: (id: string) => void; onBack: () => void }) {
  const guestLink = buildGuestLink(WEB_ORIGIN, canvas)
  const hostLink = buildHostLink(WEB_ORIGIN, canvas)
  const shareGuest = () =>
    Share.share({ message: `Join my private Drawie canvas “${canvas.title}”: ${guestLink}` }).catch(() => {})

  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}><Text style={styles.back}>‹ Canvases</Text></Pressable>
        <Text style={styles.title}>Invite</Text>
        <View style={{ width: 90 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h}>“{canvas.title}” is private</Text>
        <Text style={styles.sub}>Send the guest link to the people you want to draw with. It won't appear in public discovery.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Guest link</Text>
          <Text style={styles.hint}>Anyone with it can claim a tile and draw.</Text>
          <Text selectable style={styles.link}>{guestLink}</Text>
          <Pressable style={styles.primary} onPress={shareGuest}><Text style={styles.primaryText}>Share guest link</Text></Pressable>
          <Text style={styles.codeRow}>or share the code: <Text selectable style={styles.code}>{canvas.guestToken}</Text></Text>
        </View>

        <View style={[styles.card, styles.hostCard]}>
          <Text style={styles.label}>Host link · keep private</Text>
          <Text style={styles.hint}>Bearer of this link controls the canvas.</Text>
          <Text selectable style={styles.linkMuted}>{hostLink}</Text>
        </View>

        <Pressable style={styles.manageBtn} onPress={() => onManage(canvas.id)}>
          <Text style={styles.manageText}>Manage participants</Text>
        </Pressable>
        <Pressable style={styles.openBtn} onPress={() => onOpen(canvas.id)}>
          <Text style={styles.openText}>Open canvas →</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 90 },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  scroll: { padding: 18, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h: { fontSize: 22, fontWeight: '800', color: '#1a1a2e' },
  sub: { fontSize: 14, color: '#777', lineHeight: 20 },
  card: { borderWidth: 1, borderColor: '#ececf0', borderRadius: 16, backgroundColor: '#fafafc', padding: 16, gap: 8 },
  hostCard: { backgroundColor: '#fbfbfd' },
  label: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  hint: { fontSize: 12, color: '#999' },
  link: { fontSize: 13, color: '#3a3a4a', fontFamily: 'Courier', marginVertical: 2 },
  linkMuted: { fontSize: 12, color: '#9a9aa6', fontFamily: 'Courier' },
  primary: { backgroundColor: '#7c8cff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  codeRow: { fontSize: 12, color: '#999', marginTop: 2 },
  code: { fontFamily: 'Courier', color: '#1a1a2e', fontWeight: '700' },
  manageBtn: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  manageText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  openBtn: { borderWidth: 1, borderColor: '#e0e0e6', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  openText: { color: '#555', fontSize: 15, fontWeight: '600' },
})
