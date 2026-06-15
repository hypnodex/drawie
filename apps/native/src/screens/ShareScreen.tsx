import { View, ScrollView, Share } from 'react-native'
import { buildGuestLink, buildHostLink, type Canvas } from '@drawie/data'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { ScreenHeader } from '../components/ui/screen-header'

// Web origin for shareable invite links (opens the web join flow; also pasteable into the native
// Join screen as a token). The hosted deployment — keep in sync with the Vercel domain.
const WEB_ORIGIN = 'https://drawie-xi.vercel.app'

/**
 * Invite screen shown after founding a PRIVATE canvas. Surfaces the guest link to share with
 * participants (RN share sheet — includes Copy) and the raw guest code for pasting into the native
 * Join screen. The host link is shown but de-emphasised (control link, keep private).
 *
 * Phase 3 (native shadcn): StyleSheet → NativeWind + RN-Reusables primitives over the shadcn tokens.
 */
export function ShareScreen({ canvas, onOpen, onManage, onBack }: { canvas: Canvas; onOpen: (id: string) => void; onManage: (id: string) => void; onBack: () => void }) {
  const guestLink = buildGuestLink(WEB_ORIGIN, canvas)
  const hostLink = buildHostLink(WEB_ORIGIN, canvas)
  const shareGuest = () =>
    Share.share({ message: `Join my private Drawie canvas “${canvas.title}”: ${guestLink}` }).catch(() => {})

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Invite" onBack={onBack} backLabel="Canvases" />

      <ScrollView contentContainerClassName="w-full max-w-[720px] gap-4 self-center p-[18px]">
        <Text className="text-2xl font-extrabold text-foreground">“{canvas.title}” is private</Text>
        <Text className="text-sm leading-5 text-muted-foreground">
          Send the guest link to the people you want to draw with. It won't appear in public discovery.
        </Text>

        <View className="gap-2 rounded-2xl border border-border bg-muted p-4">
          <Text className="font-bold text-foreground">Guest link</Text>
          <Text className="text-xs text-muted-foreground">Anyone with it can claim a tile and draw.</Text>
          <Text selectable className="my-0.5 font-mono text-[13px] text-foreground">{guestLink}</Text>
          <Button onPress={shareGuest} className="mt-1">
            <Text>Share guest link</Text>
          </Button>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            or share the code: <Text selectable className="font-mono font-bold text-foreground">{canvas.guestToken}</Text>
          </Text>
        </View>

        <View className="gap-2 rounded-2xl border border-border bg-card p-4">
          <Text className="font-bold text-foreground">Host link · keep private</Text>
          <Text className="text-xs text-muted-foreground">Bearer of this link controls the canvas.</Text>
          <Text selectable className="font-mono text-xs text-muted-foreground">{hostLink}</Text>
        </View>

        <Button variant="secondary" onPress={() => onManage(canvas.id)}>
          <Text>Manage participants</Text>
        </Button>
        <Button variant="outline" onPress={() => onOpen(canvas.id)}>
          <Text>Open canvas →</Text>
        </Button>
      </ScrollView>
    </View>
  )
}
