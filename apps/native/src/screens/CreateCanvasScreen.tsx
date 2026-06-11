import { useEffect, useState } from 'react'
import {
  StyleSheet, View, Text, Pressable, ScrollView, TextInput, ActivityIndicator,
} from 'react-native'
import {
  createCanvas, getProfile, computeEntitlement, moderateContent, GUIDELINES_MESSAGE,
  supabase, type Entitlement,
} from '@drawie/data'
import type { ToolId } from '@drawie/core'
import { PALETTE } from '../ui/ColorPalette'
import { TOOL_IDS } from '../tools'

// Mirrors the web mock lists (apps/web/src/mock) — kept local so native doesn't depend on the web app.
const CATEGORIES = ['Landscape', 'Portrait', 'Abstract', 'Character', 'Surreal', 'Sci-Fi', 'Botanical', 'Architecture', 'Animal', 'Mythical']
const STYLES = ['Watercolor', 'Pixel art', 'Line art', 'Geometric', 'Pastel', 'Sketch', 'Painterly', 'Abstract', 'Minimalist', 'Cinematic']
// Shapes cover the aspect ratios (square / portrait / landscape) — the founder picks one; it sets
// gridRows × gridCols, which the mosaic and tile grid render at that aspect.
const GRID_PRESETS = [
  { label: 'Square S', rows: 3, cols: 3 },
  { label: 'Square', rows: 5, cols: 5 },
  { label: 'Square L', rows: 8, cols: 8 },
  { label: 'Portrait', rows: 8, cols: 5 },
  { label: 'Landscape', rows: 5, cols: 8 },
]

/**
 * Create-canvas wizard (MVP) — a focused single-scroll form (not the web's 4-step flow). Lets an
 * entitled user found a PUBLIC collaborative canvas: title/topic/description, category + style,
 * style guidance, and a grid-size preset. Screens the text via moderateContent before publishing
 * (mirrors web CreateCanvasWizard), then createCanvas (entitlement-gated create_canvas RPC) and
 * drops the founder into the new canvas to draw the first tile.
 *
 * Deferred (founder power-features, web-only for now): colour-palette restriction, allowed-tools
 * restriction, aspect ratios, and private-link canvases.
 */
export function CreateCanvasScreen({
  onBack, onCreated,
}: {
  onBack: () => void
  onCreated: (canvasId: string) => void
}) {
  const [entitlement, setEntitlement] = useState<Entitlement | null | undefined>(undefined)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [style, setStyle] = useState('Painterly')
  const [styleGuidance, setStyleGuidance] = useState('')
  const [grid, setGrid] = useState(GRID_PRESETS[1]) // 5×5 default
  const [paletteColors, setPaletteColors] = useState<string[]>([]) // empty = any colour
  const [toolSel, setToolSel] = useState<ToolId[]>([]) // empty = all tools
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleColor = (c: string) => setPaletteColors((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))
  const toggleTool = (t: ToolId) => setToolSel((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))

  // Pre-check entitlement so a non-eligible user sees a clear locked state rather than hitting the
  // server-side NOT_ENTITLED wall on submit. (The RPC is still the real gate.)
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
        visibility: 'public',
        neighborPreviewSize: 'small',
      })
      onCreated(canvas.id)
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
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} disabled={creating}><Text style={styles.back}>‹ Canvases</Text></Pressable>
        <Text style={styles.title}>New canvas</Text>
        <View style={{ width: 80 }} />
      </View>

      {entitlement === undefined ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#7c8cff" /></View>
      ) : !entitlement?.canCreateCanvas ? (
        <View style={styles.center}>
          <Text style={styles.lockTitle}>Found your own mosaic</Text>
          <Text style={styles.lockBody}>
            {entitlement
              ? `Complete ${entitlement.remainingTilesToFound} more tile${entitlement.remainingTilesToFound === 1 ? '' : 's'} to unlock founding a canvas — or upgrade to premium.`
              : 'Sign in to found a canvas.'}
          </Text>
          <Pressable onPress={onBack} style={styles.retry}><Text style={styles.retryText}>Back to canvases</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Field label="Title">
            <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Reef Bloom" maxLength={48} style={styles.input} placeholderTextColor="#bbb" />
          </Field>
          <Field label="Topic / theme">
            <TextInput value={topic} onChangeText={setTopic} placeholder="e.g. Coral reef at dawn" maxLength={64} style={styles.input} placeholderTextColor="#bbb" />
          </Field>
          <Field label="Description" hint="Optional">
            <TextInput value={description} onChangeText={setDescription} placeholder="What to expect, why you're starting this." maxLength={240} multiline style={[styles.input, styles.multiline]} placeholderTextColor="#bbb" />
          </Field>

          <Field label="Category">
            <Chips options={CATEGORIES} value={category} onChange={setCategory} />
          </Field>
          <Field label="Style">
            <Chips options={STYLES} value={style} onChange={setStyle} />
          </Field>

          <Field label="Style rules" hint="A short guideline contributors should follow (6+ chars)">
            <TextInput value={styleGuidance} onChangeText={setStyleGuidance} placeholder="e.g. Soft pastels, no hard outlines." maxLength={160} multiline style={[styles.input, styles.multiline]} placeholderTextColor="#bbb" />
          </Field>

          <Field label="Shape & size" hint={`${grid.rows} × ${grid.cols} · ${grid.rows * grid.cols} tiles`}>
            <View style={styles.chipsWrap}>
              {GRID_PRESETS.map((g) => (
                <Pressable key={g.label} onPress={() => setGrid(g)} style={[styles.chip, grid.label === g.label && styles.chipOn]}>
                  <Text style={[styles.chipText, grid.label === g.label && styles.chipTextOn]}>{g.label}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Field label="Colours" hint={paletteColors.length ? `${paletteColors.length} selected` : 'Any colour'}>
            <View style={styles.swatchWrap}>
              {PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => toggleColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, paletteColors.includes(c) && styles.swatchOn]}
                />
              ))}
            </View>
          </Field>

          <Field label="Tools" hint={toolSel.length ? `${toolSel.length} selected` : 'All tools'}>
            <View style={styles.chipsWrap}>
              {TOOL_IDS.map((t) => (
                <Pressable key={t} onPress={() => toggleTool(t)} style={[styles.chip, toolSel.includes(t) && styles.chipOn]}>
                  <Text style={[styles.chipText, toolSel.includes(t) && styles.chipTextOn]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </Field>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={create}
            disabled={!canPublish || creating}
            style={[styles.create, (!canPublish || creating) && styles.createOff]}
          >
            {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createText}>Create canvas</Text>}
          </Pressable>
          <Text style={styles.note}>Public · free-pick. Colour/tool limits apply to everyone. You'll draw the first tile.</Text>
        </ScrollView>
      )}
    </View>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      {children}
    </View>
  )
}

function Chips({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.chipsWrap}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, value === o && styles.chipOn]}>
          <Text style={[styles.chipText, value === o && styles.chipTextOn]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 80 },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  lockTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a2e' },
  lockBody: { fontSize: 14, color: '#777', textAlign: 'center', lineHeight: 20 },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#7c8cff', marginTop: 6 },
  retryText: { color: '#fff', fontWeight: '700' },
  scroll: { padding: 18, gap: 16, maxWidth: 720, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '700', color: '#1a1a2e' },
  hint: { fontSize: 12, color: '#999' },
  input: { borderWidth: 1, borderColor: '#e3e3e8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: '#1a1a2e', backgroundColor: '#fafafc' },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatchWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  swatchOn: { borderWidth: 3, borderColor: '#1a1a2e' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#ececf2' },
  chipOn: { backgroundColor: '#7c8cff' },
  chipText: { fontSize: 13, color: '#444', fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  gridMeta: { fontSize: 13, color: '#999', marginLeft: 4 },
  error: { color: '#ef476f', fontSize: 13, lineHeight: 18 },
  create: { backgroundColor: '#7c8cff', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  createOff: { opacity: 0.4 },
  createText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  note: { fontSize: 12, color: '#aaa', textAlign: 'center' },
})
