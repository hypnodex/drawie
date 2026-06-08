import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Modal, Spinner, Tooltip } from '@heroui/react'
import { Canvas, CanvasHandle } from '../components/Canvas'
import { BottomToolbar } from '../components/editor/BottomToolbar'
import { ToolSettingsPanel } from '../components/editor/ToolSettings'
import { LayersPanel } from '../components/editor/Layers'
import { MosaicReveal } from '../components/editor/MosaicReveal'
import { SaveIcon, SendIcon, CheckCircleIcon } from '../components/icons'
import { AssistSettings, Layer, ToolId, ToolSettingsMap } from '../types'
import type { Canvas as CanvasDomain, Tile } from '../types/domain'
import { useHistory } from '../hooks/useHistory'
import {
  clearSession, loadSession, saveSession,
  SavedSession, DEFAULT_SESSION_KEY,
} from '../session'
import { Eyebrow } from '../components/ui/Eyebrow'
import { useContentModeration } from '../hooks/useContentModeration'
import { prewarmModeration } from '../services/moderationService'
import { ModerationBlockedDialog } from '../components/moderation/ModerationBlockedDialog'

// Temporarily paused: the artboard-coverage gate before submitting is disabled
// (set back to 50 to require 50% of the tile to be drawn before Submit enables).
const MIN_SUBMIT_COVERAGE = 0

function computeCanvasCoverage(src: HTMLCanvasElement): number {
  const SAMPLER_SIZE = 200
  const oc = document.createElement('canvas')
  oc.width = SAMPLER_SIZE
  oc.height = SAMPLER_SIZE
  const ctx = oc.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SAMPLER_SIZE, SAMPLER_SIZE)
  ctx.drawImage(src, 0, 0, SAMPLER_SIZE, SAMPLER_SIZE)
  const data = ctx.getImageData(0, 0, SAMPLER_SIZE, SAMPLER_SIZE).data
  let drawn = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) drawn++
  }
  return (drawn / (SAMPLER_SIZE * SAMPLER_SIZE)) * 100
}

const COMMON = { hardness: 0.6, shape: 'circle' as const, texture: 'none' as const, blending: 0, dilution: 0, persistence: 0.7, buildUp: false }
const DEFAULT_SETTINGS: ToolSettingsMap = {
  brush:      { color: '#7c8cff', size: 28, opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, buildUp: true },
  drybrush:   { color: '#111318', size: 46, opacity: 0.95, softness: 0.5, strength: 0.65,pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  inkbrush:   { color: '#0a0b0e', size: 64, opacity: 1.0,  softness: 0.5, strength: 0.5, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pencil:     { color: '#0a0b0e', size: 6,  opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  pen:        { color: '#111318', size: 4,  opacity: 1.0,  softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON, hardness: 1 },
  marker:     { color: '#ffd166', size: 36, opacity: 0.6,  softness: 0.5, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON, hardness: 0.75, buildUp: true },
  watercolor: { color: '#118ab2', size: 40, opacity: 0.85, softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: true,  ...COMMON, hardness: 0.25, blending: 0.4, dilution: 0.3, buildUp: true },
  spray:      { color: '#ef476f', size: 60, opacity: 0.7,  softness: 0.5, strength: 0.6, pressureSim: true,  wetPaint: false, ...COMMON },
  eraser:     { color: '#000000', size: 30, opacity: 1.0,  softness: 0.4, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON },
  smudge:     { color: '#000000', size: 36, opacity: 1.0,  softness: 0.5, strength: 0.55,pressureSim: false, wetPaint: false, ...COMMON },
  waterdrop:  { color: 'transparent', size: 80, opacity: 0.7, softness: 0.5, strength: 0.6, pressureSim: false, wetPaint: false, ...COMMON },
}

const DEFAULT_ASSIST: AssistSettings = {
  stabilize: false, stabilizeStrength: 0.5,
  shapeAssist: false, shapeStrength: 0.6,
  perfectShape: true, holdToSnap: false, holdDelay: 500,
}

const INITIAL_LAYERS: Layer[] = [{ id: 'l1', name: 'Layer 1', visible: true }]
const RECENT_MAX = 8

interface Props {
  canvas?: CanvasDomain
  tile?: Tile
  tiles?: Tile[]
  sessionKey?: string
  /** Receives the composited artboard PNG so the caller can persist it. */
  onSubmit?: (image?: Blob) => void | Promise<void>
  onLeave?: (action: 'save' | 'discard') => void
}

export default function DrawingScreen({
  canvas, tile, tiles, sessionKey: sessionKeyProp, onSubmit: onSubmitProp, onLeave: onLeaveProp,
}: Props = {}) {
  const sessionKey = sessionKeyProp ?? DEFAULT_SESSION_KEY
  const allowedTools = canvas && canvas.allowedTools.length > 0 ? canvas.allowedTools : undefined
  const paletteOverride = canvas?.colorPalette ?? null

  const [tool, setTool] = useState<ToolId>('brush')
  const [settingsMap, setSettingsMap] = useState<ToolSettingsMap>(DEFAULT_SETTINGS)
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [secondaryColor, setSecondaryColor] = useState<string>('#ffffff')
  const [revealOpen, setRevealOpen] = useState(false)
  const [popover, setPopover] = useState<'tool' | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [saveJustDone, setSaveJustDone] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [coveragePct, setCoveragePct] = useState(0)
  const [displayZoom, setDisplayZoom] = useState(100)
  const coverageTimer = useRef<number | null>(null)
  const coverageMet = coveragePct >= MIN_SUBMIT_COVERAGE

  const [layers, setLayers] = useState<Layer[]>(INITIAL_LAYERS)
  const [activeLayerId, setActiveLayerId] = useState<string>(INITIAL_LAYERS[0].id)
  const layerSeq = useRef(2)

  const canvasRef = useRef<CanvasHandle>(null)
  const history = useHistory(10)

  // Restore saved session on first mount
  useEffect(() => {
    const s = loadSession(sessionKey)
    if (!s) return
    setSettingsMap(s.settingsMap)
    setTool(s.tool)
    setSecondaryColor(s.secondaryColor)
    setRecentColors(s.recentColors)
    setLayers(s.layers.map(({ dataURL: _, ...rest }) => rest))
    setActiveLayerId(s.activeLayerId)
    const t = window.setTimeout(() => {
      s.layers.forEach(({ id, dataURL }) => {
        canvasRef.current?.loadLayerFromDataURL(id, dataURL).catch(() => {})
      })
    }, 60)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Force tool to one of allowed (if canvas restricts)
  useEffect(() => {
    if (!allowedTools) return
    if (!allowedTools.includes(tool)) setTool(allowedTools[0])
  }, [allowedTools, tool])

  // Force palette compliance
  useEffect(() => {
    if (!paletteOverride || paletteOverride.length === 0) return
    const allowed = new Set(paletteOverride.map((c: string) => c.toLowerCase()))
    setSettingsMap((prev) => {
      let changed = false
      const out: ToolSettingsMap = { ...prev }
      for (const k of Object.keys(prev) as ToolId[]) {
        if (!allowed.has(prev[k].color.toLowerCase())) {
          out[k] = { ...prev[k], color: paletteOverride[0] }
          changed = true
        }
      }
      return changed ? out : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteOverride])

  const settings = settingsMap[tool]

  const onToolSettingsChange = useCallback((patch: Partial<typeof settings>) => {
    setSettingsMap((prev) => ({ ...prev, [tool]: { ...prev[tool], ...patch } }))
    if (patch.color && patch.color !== 'transparent') {
      setRecentColors((prev) => {
        const filtered = prev.filter((c) => c.toLowerCase() !== patch.color!.toLowerCase())
        return [patch.color!, ...filtered].slice(0, RECENT_MAX)
      })
    }
  }, [tool])

  const onSwapColors = useCallback(() => {
    setSettingsMap((prev) => ({ ...prev, [tool]: { ...prev[tool], color: secondaryColor } }))
    setSecondaryColor(settings.color)
  }, [tool, secondaryColor, settings.color])

  // ── Layers ──
  const onAddLayer = useCallback(() => {
    const id = `l${layerSeq.current++}`
    const newLayer: Layer = { id, name: `Layer ${layers.length + 1}`, visible: true }
    setLayers((prev) => [...prev, newLayer])
    setActiveLayerId(id)
  }, [layers.length])

  const onRemoveLayer = useCallback((id: string) => {
    setLayers((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((l) => l.id !== id)
      if (id === activeLayerId) {
        const idx = prev.findIndex((l) => l.id === id)
        setActiveLayerId(next[Math.max(0, idx - 1)].id)
      }
      return next
    })
    canvasRef.current?.clearLayer(id)
  }, [activeLayerId])

  const onMergeDown = useCallback((id: string) => {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id)
      if (idx <= 0) return prev
      const below = prev[idx - 1]
      canvasRef.current?.mergeIntoLayer(id, below.id)
      return prev.filter((l) => l.id !== id)
    })
    if (id === activeLayerId) {
      setActiveLayerId(layers[Math.max(0, layers.findIndex((l) => l.id === id) - 1)].id)
    }
  }, [activeLayerId, layers])

  const onToggleVisible = useCallback((id: string) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, visible: !l.visible } : l))
  }, [])

  // ── History (undo / redo / clear) ──
  const snapshot = useCallback(() => {
    const snap = canvasRef.current?.takeLayerSnapshot(activeLayerId)
    if (snap) history.push(activeLayerId, snap)
  }, [activeLayerId, history])

  const onUndo = useCallback(() => {
    const current = canvasRef.current?.takeLayerSnapshot(activeLayerId)
    if (!current) return
    const prev = history.undo(activeLayerId, current)
    if (prev) canvasRef.current?.restoreLayerSnapshot(activeLayerId, prev)
  }, [activeLayerId, history])

  const onRedo = useCallback(() => {
    const current = canvasRef.current?.takeLayerSnapshot(activeLayerId)
    if (!current) return
    const next = history.redo(activeLayerId, current)
    if (next) canvasRef.current?.restoreLayerSnapshot(activeLayerId, next)
  }, [activeLayerId, history])

  const onClear = useCallback(() => {
    snapshot()
    canvasRef.current?.clearLayer(activeLayerId)
  }, [activeLayerId, snapshot])

  // ── Coverage gauge (debounced) ──
  const recomputeCoverage = useCallback(() => {
    if (coverageTimer.current) window.clearTimeout(coverageTimer.current)
    coverageTimer.current = window.setTimeout(() => {
      const c = canvasRef.current?.getCompositeCanvas()
      if (c) setCoveragePct(computeCanvasCoverage(c))
    }, 250)
  }, [])

  // ── Content moderation ──
  const moderation = useContentModeration()
  const [blockedOpen, setBlockedOpen] = useState(false)

  // Warm up the NSFW model + OCR worker in the background while the user draws,
  // so the first Submit/Save isn't blocked on a cold-start load.
  useEffect(() => { prewarmModeration() }, [])

  /** Screen the rendered artboard. Returns true when it's clean (safe to save/
   *  submit). On a block/error it opens the blocked dialog and returns false —
   *  the caller must abort, leaving the user's work untouched. */
  const passesModeration = useCallback(async (): Promise<boolean> => {
    const image = canvasRef.current?.getCompositeCanvas() ?? null
    const ok = await moderation.check({ image })
    if (!ok) setBlockedOpen(true)
    return ok
  }, [moderation])

  // ── Save / Submit ──
  const persistSession = useCallback(() => {
    const layersData = layers.map((l) => ({
      id: l.id, name: l.name, visible: l.visible,
      dataURL: canvasRef.current?.getLayerDataURL(l.id) ?? '',
    }))
    const session: SavedSession = {
      layers: layersData, activeLayerId, tool, settingsMap, secondaryColor, recentColors,
      assist: DEFAULT_ASSIST, theme: 'light',
      timeRemainingSec: 0, savedAt: Date.now(),
    }
    saveSession(session, sessionKey)
  }, [layers, activeLayerId, tool, settingsMap, secondaryColor, recentColors, sessionKey])

  const handleSaveConfirmed = useCallback(async () => {
    if (!(await passesModeration())) { setSaveConfirmOpen(false); return }
    persistSession()
    setSaveConfirmOpen(false)
    setSaveJustDone(true)
    window.setTimeout(() => setSaveJustDone(false), 1800)
  }, [passesModeration, persistSession])

  const onSubmit = useCallback(async () => {
    if (!(await passesModeration())) return
    // Composite the artboard to a PNG blob so the caller can upload it as the
    // tile's artwork before the local draft is cleared.
    const composite = canvasRef.current?.getCompositeCanvas()
    const blob = composite
      ? await new Promise<Blob | null>((res) => composite.toBlob((b) => res(b), 'image/png'))
      : null
    clearSession(sessionKey)
    setSubmitted(true)
    setTimeout(() => { void onSubmitProp?.(blob ?? undefined) }, 1200)
  }, [passesModeration, sessionKey, onSubmitProp])

  const onLeaveSave = async () => {
    // Block the save, but keep the user on the canvas (work preserved) so they
    // can edit and retry rather than losing it to a discard.
    if (!(await passesModeration())) { setLeaveOpen(false); return }
    persistSession()
    setLeaveOpen(false)
    onLeaveProp?.('save')
  }
  const onLeaveDiscard = () => {
    clearSession(sessionKey)
    setLeaveOpen(false)
    onLeaveProp?.('discard')
  }

  const settingsPanel = useMemo(() => (
    <ToolSettingsPanel
      tool={tool}
      settings={settings}
      recentColors={recentColors}
      secondaryColor={secondaryColor}
      onSecondaryChange={setSecondaryColor}
      onSwapColors={onSwapColors}
      onChange={onToolSettingsChange}
      paletteOverride={paletteOverride}
    />
  ), [tool, settings, recentColors, secondaryColor, paletteOverride, onSwapColors, onToolSettingsChange])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Top bar: leave + submit */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-start justify-between gap-3 p-4 pointer-events-none">
        <Button variant="secondary" size="md" onPress={() => setLeaveOpen(true)} className="pointer-events-auto">
          ← Leave
        </Button>

        {/* Style rules — truly centred in the bar, independent of side buttons */}
        {canvas && (
          <div className="absolute left-1/2 top-4 -translate-x-1/2 hidden md:block text-center pointer-events-none">
            <Eyebrow>Style rules</Eyebrow>
            <p className="mt-1 text-sm italic text-[var(--foreground)] leading-snug max-w-[360px]">"{canvas.styleGuidance}"</p>
          </div>
        )}

        <div className="flex items-center gap-2 pointer-events-auto">
          <CoverageGauge pct={coveragePct} met={coverageMet} />
          {coverageMet ? (
            <Button variant="primary" size="md" onPress={onSubmit} isDisabled={moderation.isChecking}>
              {moderation.isChecking
                ? <><Spinner size="sm" /> Checking…</>
                : <><SendIcon width={16} height={16} /> Submit</>}
            </Button>
          ) : (
            <Tooltip>
              <Tooltip.Trigger>
                <span className="inline-flex">
                  <Button variant="primary" size="md" isDisabled aria-disabled="true">
                    <SendIcon width={16} height={16} /> Submit
                  </Button>
                </span>
              </Tooltip.Trigger>
              <Tooltip.Content>
                Fill at least {MIN_SUBMIT_COVERAGE}% of the artboard to submit
                <br />
                <span className="opacity-60">currently {Math.round(coveragePct)}%</span>
              </Tooltip.Content>
            </Tooltip>
          )}
          <Button variant="secondary" size="md" onPress={() => setSaveConfirmOpen(true)} isDisabled={moderation.isChecking}>
            <SaveIcon width={16} height={16} /> {saveJustDone ? 'Saved ✓' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Layers panel (top-right) */}
      <div className="absolute top-20 right-4 z-20">
        <LayersPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSelect={setActiveLayerId}
          onToggleVisible={onToggleVisible}
          onAdd={onAddLayer}
          onRemove={onRemoveLayer}
          onMergeDown={onMergeDown}
          floating
        />
      </div>

      {/* Stage */}
      <div className="absolute inset-0 stage-bg">
        <Canvas
          ref={canvasRef}
          tool={tool}
          settings={settings}
          assist={DEFAULT_ASSIST}
          layers={layers}
          activeLayerId={activeLayerId}
          popoverOpen={popover !== null}
          onDismissPopover={() => setPopover(null)}
          onStrokeStart={snapshot}
          onStrokeEnd={recomputeCoverage}
          onZoomChange={(z) => setDisplayZoom(Math.round(z * 100))}
          tileRow={tile?.row}
          tileCol={tile?.col}
          gridRows={canvas?.gridRows}
          gridCols={canvas?.gridCols}
        />
      </div>

      {/* Bottom controls — zoom bar + toolbar laid out in one responsive row.
          flex-wrap lets the zoom bar drop above the toolbar on narrow screens
          instead of overlapping it. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 px-3 pb-3 flex items-end justify-center gap-2 flex-wrap">
        {/* h-[4.5rem] matches the tool pill height (p-2 + h-14 buttons = 72px) */}
        <div className="pointer-events-auto flex items-center gap-1 px-3 h-[4.5rem] rounded-[1.75rem] bg-[var(--surface)]/95 backdrop-blur shadow-lg shrink-0">
          <ZoomButton label="Fit" onPress={() => canvasRef.current?.zoomFit()} />
          <div className="w-px h-7 bg-[var(--separator)]" aria-hidden />
          <ZoomButton label="−" onPress={() => canvasRef.current?.zoomOut()} />
          <span className="min-w-[3rem] text-center font-mono text-[11px] font-bold text-[var(--foreground)] tabular-nums select-none">
            {displayZoom}%
          </span>
          <ZoomButton label="+" onPress={() => canvasRef.current?.zoomIn()} />
        </div>

        <BottomToolbar
          tool={tool}
          settingsMap={settingsMap}
          popoverOpen={popover === 'tool'}
          popoverContent={settingsPanel}
          onToolButtonClick={(id) => {
            if (tool === id) setPopover((p) => p === 'tool' ? null : 'tool')
            else { setTool(id); setPopover('tool') }
          }}
          onPopoverOutsideClose={() => setPopover(null)}
          canUndo={history.canUndo(activeLayerId)}
          canRedo={history.canRedo(activeLayerId)}
          onUndo={onUndo}
          onRedo={onRedo}
          onClear={onClear}
          onReveal={() => setRevealOpen(true)}
          allowedTools={allowedTools}
        />
      </div>

      {/* Mosaic reveal */}
      <MosaicReveal
        isOpen={revealOpen}
        onClose={() => setRevealOpen(false)}
        activeTileCanvas={canvasRef.current?.getCompositeCanvas() ?? null}
        canvas={canvas}
        tiles={tiles}
        userTile={tile}
      />

      {/* Leave dialog */}
      <Modal isOpen={leaveOpen} onOpenChange={(open) => !open && setLeaveOpen(false)}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog>
              <Modal.Header className="mb-2">
                <Eyebrow variant="dot">Leaving</Eyebrow>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">Save or discard?</h2>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-[var(--muted)]">
                  Your tile is in progress. Save it as a draft and come back later, or discard
                  everything you've drawn so far.
                </p>
              </Modal.Body>
              <Modal.Footer className="mt-6 flex flex-col gap-2 w-full">
                <Button variant="primary" size="md" fullWidth onPress={onLeaveSave} isDisabled={moderation.isChecking}>
                  {moderation.isChecking ? <><Spinner size="sm" /> Checking…</> : 'Save & leave'}
                </Button>
                <Button variant="secondary" size="md" fullWidth onPress={onLeaveDiscard} isDisabled={moderation.isChecking}>Discard & leave</Button>
                <Button variant="ghost" size="md" fullWidth onPress={() => setLeaveOpen(false)}>Stay drawing</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Save confirm dialog */}
      <Modal isOpen={saveConfirmOpen} onOpenChange={(open) => !open && setSaveConfirmOpen(false)}>
        <Modal.Backdrop variant="blur">
          <Modal.Container size="sm" placement="center">
            <Modal.Dialog>
              <Modal.Header className="mb-2">
                <Eyebrow variant="dot">Save draft</Eyebrow>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">Save current progress?</h2>
              </Modal.Header>
              <Modal.Body>
                <p className="text-sm text-[var(--muted)]">
                  Your layers, tool settings, and recent colors will be stored locally. You can pick
                  up exactly where you left off the next time you open this tile.
                </p>
              </Modal.Body>
              <Modal.Footer className="mt-6 flex flex-col gap-2 w-full">
                <Button variant="primary" size="md" fullWidth onPress={handleSaveConfirmed} isDisabled={moderation.isChecking}>
                  {moderation.isChecking ? <><Spinner size="sm" /> Checking content…</> : 'Save draft'}
                </Button>
                <Button variant="ghost" size="md" fullWidth onPress={() => setSaveConfirmOpen(false)} isDisabled={moderation.isChecking}>Cancel</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Moderation-blocked dialog (Save / Submit) — work is never touched */}
      <ModerationBlockedDialog
        isOpen={blockedOpen}
        onClose={() => { setBlockedOpen(false); moderation.reset() }}
        message={moderation.message}
        isError={moderation.status === 'error'}
      />

      {/* Submitted overlay */}
      {submitted && (
        <div className="fixed inset-0 z-50 bg-[var(--background)]/95 backdrop-blur flex items-center justify-center">
          <div className="text-center flex flex-col items-center gap-4">
            <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--success)] text-[var(--success-foreground)]">
              <CheckCircleIcon width={40} height={40} />
            </span>
            <Eyebrow variant="dot">Submitted</Eyebrow>
            <h2 className="text-2xl font-extrabold tracking-tight">Your tile is in the mosaic.</h2>
            <p className="text-sm text-[var(--muted)] max-w-md">
              When everyone finishes, you'll get a notification with the full reveal.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function ZoomButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] active:scale-90 transition-transform select-none"
    >
      {label}
    </button>
  )
}

/**
 * Coverage progress — custom SVG circular ring. (HeroUI v3's ProgressCircle
 * is a compound that needs Track + TrackCircle + FillCircle children to
 * actually paint; rolling our own gives us a stable visual and exact control
 * over the threshold gradient.)
 */
function CoverageGauge({ pct, met }: { pct: number; met: boolean }) {
  const v = Math.round(Math.min(100, pct))
  const size = 36
  const stroke = 4
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (v / 100) * circ
  return (
    <div
      className="flex items-center gap-2 rounded-full bg-[var(--surface-secondary)] pl-1.5 pr-3 py-1"
      title={`Drawing coverage: ${v}% (need ${MIN_SUBMIT_COVERAGE}% to submit)`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-label="Drawing coverage">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-tertiary)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={met ? 'var(--success)' : 'var(--accent)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 200ms ease, stroke 200ms ease' }}
        />
      </svg>
      <div className="text-[10px] font-mono tabular-nums leading-tight">
        <div className="font-bold text-[var(--foreground)]">{v}%</div>
        <div className={met ? 'text-[var(--success)]' : 'text-[var(--muted)]'}>
          {met ? 'ready' : `${MIN_SUBMIT_COVERAGE}% min`}
        </div>
      </div>
    </div>
  )
}
