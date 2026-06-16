import { useEffect, useState } from 'react'
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import {
  createCanvas, getProfile, computeEntitlement, moderateContent, GUIDELINES_MESSAGE,
  supabase, type Entitlement, type Canvas,
} from '@drawie/data'
import type { ToolId } from '@drawie/core'
import { PALETTE } from '../ui/ColorPalette'
import { TOOL_IDS } from '../tools'
import { Text } from '../components/ui/text'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ScreenHeader } from '../components/ui/screen-header'
import { cn } from '../lib/cn'
import { tokenColors } from '../theme/tokenColors'

const SPINNER = tokenColors.primary

// Mirrors the web mock lists (apps/web/src/mock) — kept local so native doesn't depend on the web app.
const CATEGORIES = ['Landscape', 'Portrait', 'Abstract', 'Character', 'Surreal', 'Sci-Fi', 'Botanical', 'Architecture', 'Animal', 'Mythical']
const STYLES = ['Watercolor', 'Pixel art', 'Line art', 'Geometric', 'Pastel', 'Sketch', 'Painterly', 'Abstract', 'Minimalist', 'Cinematic']
const GRID_PRESETS = [
  { label: 'Square S', rows: 3, cols: 3 },
  { label: 'Square', rows: 5, cols: 5 },
  { label: 'Square L', rows: 8, cols: 8 },
  { label: 'Portrait', rows: 8, cols: 5 },
  { label: 'Landscape', rows: 5, cols: 8 },
]

/**
 * Create-canvas wizard (MVP) — a focused single-scroll form. Founds a PUBLIC collaborative canvas,
 * screening the text via moderateContent before createCanvas, then drops the founder into it.
 *
 * Phase 3 (native shadcn): StyleSheet → NativeWind + RN-Reusables primitives over the shadcn tokens.
 */
export function CreateCanvasScreen({
  onBack, onCreated,
}: {
  onBack: () => void
  onCreated: (canvas: Canvas) => void
}) {
  const [entitlement, setEntitlement] = useState<Entitlement | null | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [style, setStyle] = useState('Painterly')
  const [styleGuidance, setStyleGuidance] = useState('')
  const [grid, setGrid] = useState(GRID_PRESETS[1]) // 5×5 default
  const [visibility, setVisibility] = useState<'public' | 'private-link'>('public')
  const [paletteColors, setPaletteColors] = useState<string[]>([]) // empty = any colour
  const [toolSel, setToolSel] = useState<ToolId[]>([]) // empty = all tools
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleColor = (c: string) => setPaletteColors((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))
  const toggleTool = (t: ToolId) => setToolSel((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))

  // Pre-check entitlement so a non-eligible user sees a clear locked state rather than the server wall.
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const profile = user ? await getProfile(user.id) : null
        if (alive) setEntitlement(profile ? computeEntitlement(profile) : null)
      } catch {
        if (alive) setEntitlement(null)
      }
    })()
    return () => { alive = false }
  }, [])

  const canPublish = title.trim().length > 1 && topic.trim().length > 0 && styleGuidance.trim().length > 5

  const create = async () => {
    if (!canPublish || creating) return
    setError(null)
    setCreating(true)
    try {
      const verdict = await moderateContent({ texts: [title, description, topic, styleGuidance] })
      if (!verdict.allowed) {
        setError(verdict.message || GUIDELINES_MESSAGE)
        setCreating(false)
        return
      }
      const isPrivate = visibility === 'private-link' && !!entitlement?.isPremium
      const canvas = await createCanvas({
        title: title.trim(),
        description: description.trim() || topic.trim(),
        category,
        topic: topic.trim(),
        style,
        gridRows: grid.rows,
        gridCols: grid.cols,
        allowedTools: toolSel,
        colorPalette: paletteColors.length ? paletteColors : null,
        background: '#ffffff',
        styleGuidance: styleGuidance.trim(),
        participationMode: 'free-pick',
        visibility: isPrivate ? 'private-link' : 'public',
        participantCount: isPrivate ? grid.rows * grid.cols : undefined,
        neighborPreviewSize: 'small',
      })
      onCreated(canvas)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        msg.includes('NOT_ENTITLED')
          ? 'You need to complete 5 tiles (or go premium) before founding a canvas.'
          : msg,
      )
      setCreating(false)
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="New canvas" onBack={creating ? undefined : onBack} backLabel="Canvases" />

      {entitlement === undefined ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={SPINNER} /></View>
      ) : !entitlement?.canCreateCanvas ? (
        <View className="flex-1 items-center justify-center gap-3 px-7">
          <Text className="text-xl font-extrabold text-foreground">Found your own mosaic</Text>
          <Text className="text-center text-sm leading-5 text-muted-foreground">
            {entitlement
              ? `Complete ${entitlement.remainingTilesToFound} more tile${entitlement.remainingTilesToFound === 1 ? '' : 's'} to unlock founding a canvas — or upgrade to premium.`
              : 'Sign in to found a canvas.'}
          </Text>
          <Button onPress={onBack} className="mt-1.5"><Text>Back to canvases</Text></Button>
        </View>
      ) : (
        <ScrollView contentContainerClassName="w-full max-w-[720px] gap-4 self-center p-[18px] pb-10" keyboardShouldPersistTaps="handled">
          <Field label="Title">
            <Input value={title} onChangeText={setTitle} placeholder="e.g. Reef Bloom" maxLength={48} />
          </Field>
          <Field label="Topic / theme">
            <Input value={topic} onChangeText={setTopic} placeholder="e.g. Coral reef at dawn" maxLength={64} />
          </Field>
          <Field label="Description" hint="Optional">
            <Input value={description} onChangeText={setDescription} placeholder="What to expect, why you're starting this." maxLength={240} multiline textAlignVertical="top" className="h-auto min-h-[72px] py-2.5" />
          </Field>

          <Field label="Category"><Chips options={CATEGORIES} value={category} onChange={setCategory} /></Field>
          <Field label="Style"><Chips options={STYLES} value={style} onChange={setStyle} /></Field>

          <Field label="Style rules" hint="A short guideline contributors should follow (6+ chars)">
            <Input value={styleGuidance} onChangeText={setStyleGuidance} placeholder="e.g. Soft pastels, no hard outlines." maxLength={160} multiline textAlignVertical="top" className="h-auto min-h-[72px] py-2.5" />
          </Field>

          <Field label="Shape & size" hint={`${grid.rows} × ${grid.cols} · ${grid.rows * grid.cols} tiles`}>
            <View className="flex-row flex-wrap gap-2">
              {GRID_PRESETS.map((g) => (
                <Chip key={g.label} label={g.label} selected={grid.label === g.label} onPress={() => setGrid(g)} />
              ))}
            </View>
          </Field>

          <Field label="Visibility" hint={visibility === 'private-link' ? 'Invite-only — share a link' : 'Public — anyone can join'}>
            <View className="flex-row items-center gap-2">
              <Chip label="Public" selected={visibility === 'public'} onPress={() => setVisibility('public')} />
              <Chip
                label={entitlement?.isPremium ? 'Private' : 'Private · Premium'}
                selected={visibility === 'private-link'}
                disabled={!entitlement?.isPremium}
                onPress={() => entitlement?.isPremium && setVisibility('private-link')}
              />
            </View>
          </Field>

          <Field label="Colours" hint={paletteColors.length ? `${paletteColors.length} selected` : 'Any colour'}>
            <View className="flex-row flex-wrap gap-2.5">
              {PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => toggleColor(c)}
                  className={cn('h-[30px] w-[30px] rounded-full border', paletteColors.includes(c) ? 'border-[3px] border-foreground' : 'border-black/10')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </View>
          </Field>

          <Field label="Tools" hint={toolSel.length ? `${toolSel.length} selected` : 'All tools'}>
            <View className="flex-row flex-wrap gap-2">
              {TOOL_IDS.map((t) => (
                <Chip key={t} label={t} selected={toolSel.includes(t)} onPress={() => toggleTool(t)} />
              ))}
            </View>
          </Field>

          {!!error && <Text className="text-sm leading-[18px] text-destructive">{error}</Text>}

          <Button size="lg" onPress={create} disabled={!canPublish || creating} className="mt-1">
            {creating ? <ActivityIndicator size="small" color="white" /> : <Text className="text-base font-extrabold">Create canvas</Text>}
          </Button>
          <Text className="text-center text-xs text-muted-foreground">Public · free-pick. Colour/tool limits apply to everyone. You'll draw the first tile.</Text>
        </ScrollView>
      )}
    </View>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-sm font-bold text-foreground">{label}</Text>
        {!!hint && <Text className="text-xs text-muted-foreground">{hint}</Text>}
      </View>
      {children}
    </View>
  )
}

/** Selectable pill — selected = brand primary, else muted secondary. */
function Chip({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={cn('rounded-2xl px-3.5 py-2', selected ? 'bg-primary' : 'bg-secondary', disabled && 'opacity-50')}
    >
      <Text className={cn('text-[13px] font-semibold', selected ? 'text-primary-foreground' : 'text-secondary-foreground')}>{label}</Text>
    </Pressable>
  )
}

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} label={o} selected={value === o} onPress={() => onChange(o)} />
      ))}
    </View>
  )
}
