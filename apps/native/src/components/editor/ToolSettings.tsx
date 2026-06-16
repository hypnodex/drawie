import { View, Pressable } from 'react-native'
import type { ToolId, ToolSettings as ToolSettingsType, BrushShape } from '@drawie/core'
import { Text } from '../ui/text'
import { cn } from '../../lib/cn'
import { Slider } from '../../ui/Slider'
import { ColorPalette } from '../../ui/ColorPalette'
import { TexturePicker } from '../../ui/TexturePicker'
import { PressureIcon, WetIcon, BuildUpIcon } from '../icons'
import { tokenColors } from '../../theme/tokenColors'

const FG = tokenColors.foreground
const MUTED = tokenColors.mutedForeground
const PRIMARY = tokenColors.primary

/**
 * Per-tool settings — mirrors the web ToolSettingsPanel: each tool exposes a DIFFERENT set of
 * controls (driven by TOOL_META), not a fixed four sliders. Ported 1:1 from
 * apps/web/src/components/editor/ToolSettings.tsx so native and web stay in sync.
 */
type ToolMeta = {
  name: string; subtitle: string
  usesColor: boolean; usesPressure: boolean; usesWet: boolean; usesSoftness: boolean
  usesStrength: boolean; usesHardness: boolean; usesShape: boolean; usesBlending: boolean
  usesDilution: boolean; usesBuildUp: boolean; usesTexture: boolean
}

const TOOL_META: Record<ToolId, ToolMeta> = {
  brush:      { name: 'Brush',      subtitle: 'Soft round, painterly',          usesColor: true,  usesPressure: true,  usesWet: true,  usesSoftness: false, usesStrength: false, usesHardness: true,  usesShape: true,  usesBlending: true,  usesDilution: true,  usesBuildUp: true,  usesTexture: true  },
  drybrush:   { name: 'Dry Brush',  subtitle: 'Bristle streaks, broken edges',  usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  inkbrush:   { name: 'Ink Brush',  subtitle: 'Heavy dry-bristle ink',          usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  pencil:     { name: 'Pencil',     subtitle: 'Thin textured stroke',           usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  pen:        { name: 'Ink Pen',    subtitle: 'Crisp sharp line',               usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  marker:     { name: 'Marker',     subtitle: 'Wide semi-transparent',          usesColor: true,  usesPressure: true,  usesWet: true,  usesSoftness: false, usesStrength: false, usesHardness: true,  usesShape: true,  usesBlending: true,  usesDilution: true,  usesBuildUp: true,  usesTexture: true  },
  watercolor: { name: 'Watercolor', subtitle: 'Pools where you dwell',          usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: false, usesHardness: true,  usesShape: true,  usesBlending: true,  usesDilution: true,  usesBuildUp: true,  usesTexture: false },
  spray:      { name: 'Spray',      subtitle: 'Airbrush — scattered particles', usesColor: true,  usesPressure: true,  usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  eraser:     { name: 'Eraser',     subtitle: 'Remove from active tile',        usesColor: false, usesPressure: false, usesWet: false, usesSoftness: true,  usesStrength: false, usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  smudge:     { name: 'Smudge',     subtitle: 'Smear nearby pixels',            usesColor: false, usesPressure: false, usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
  waterdrop:  { name: 'Waterdrop',  subtitle: 'Spread wet colors outward',      usesColor: true,  usesPressure: false, usesWet: false, usesSoftness: false, usesStrength: true,  usesHardness: false, usesShape: false, usesBlending: false, usesDilution: false, usesBuildUp: false, usesTexture: false },
}

const pct = (v: number) => `${Math.round(v * 100)}%`

export function ToolSettingsPanel({
  tool, settings, onChange, palette,
}: {
  tool: ToolId
  settings: ToolSettingsType
  onChange: (patch: Partial<ToolSettingsType>) => void
  palette?: string[]
}) {
  const meta = TOOL_META[tool]
  const waterOnly = tool === 'waterdrop' && settings.color === 'transparent'

  return (
    <View className="gap-1">
      <View className="px-1 pb-0.5">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tool</Text>
        <Text className="text-base font-semibold text-foreground">{meta.name}</Text>
        <Text className="text-[11px] text-muted-foreground">{meta.subtitle}</Text>
      </View>

      {meta.usesColor && (
        <>
          {tool === 'waterdrop' && (
            <Pressable
              onPress={() => onChange({ color: waterOnly ? '#74c2f0' : 'transparent' })}
              className={cn('mb-1 flex-row items-center gap-2 self-start rounded-xl px-2.5 py-1.5', waterOnly ? 'bg-primary/15' : 'bg-secondary')}
            >
              <View className="h-6 w-6 rounded-full border border-border bg-[#dfe3ea]" />
              <Text className={cn('text-xs', waterOnly ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {waterOnly ? 'Water only — no ink' : 'Tap for water-only'}
              </Text>
            </Pressable>
          )}
          {!waterOnly && (
            <ColorPalette color={settings.color === 'transparent' ? '#74c2f0' : settings.color} onChange={(c) => onChange({ color: c })} palette={palette} />
          )}
        </>
      )}

      <Slider label="Size" value={settings.size} min={1} max={120} onChange={(v) => onChange({ size: v })} format={(v) => `${Math.round(v)}px`} />

      {tool !== 'eraser' && tool !== 'smudge' && !waterOnly && (
        <Slider label="Opacity" value={settings.opacity} min={0.05} max={1} step={0.01} onChange={(v) => onChange({ opacity: v })} format={pct} />
      )}
      {meta.usesHardness && (
        <Slider label="Hardness" value={settings.hardness} min={0} max={1} step={0.01} onChange={(v) => onChange({ hardness: v })} format={pct} />
      )}
      {meta.usesShape && <ShapePicker value={settings.shape} onChange={(shape) => onChange({ shape })} />}
      {meta.usesTexture && <TexturePicker value={settings.texture} onChange={(t) => onChange({ texture: t })} />}
      {meta.usesBlending && (
        <Slider label="Blending" value={settings.blending} min={0} max={1} step={0.01} onChange={(v) => onChange({ blending: v })} format={pct} />
      )}
      {meta.usesDilution && (
        <>
          <Slider label="Dilution" value={settings.dilution} min={0} max={1} step={0.01} onChange={(v) => onChange({ dilution: v })} format={pct} />
          <Slider label="Persist" value={settings.persistence} min={0} max={1} step={0.01} onChange={(v) => onChange({ persistence: v })} format={pct} />
        </>
      )}
      {meta.usesSoftness && (
        <Slider label="Softness" value={settings.softness} min={0} max={1} step={0.01} onChange={(v) => onChange({ softness: v })} format={pct} />
      )}
      {meta.usesStrength && (
        <Slider
          label={tool === 'spray' ? 'Density' : tool === 'drybrush' || tool === 'inkbrush' ? 'Dryness' : 'Strength'}
          value={settings.strength} min={0.05} max={1} step={0.01} onChange={(v) => onChange({ strength: v })} format={pct}
        />
      )}

      {(meta.usesPressure || meta.usesWet || meta.usesBuildUp) && (
        <View className="mt-0.5 flex-row flex-wrap gap-1.5">
          {meta.usesPressure && <Toggle label="Pressure" Icon={PressureIcon} checked={settings.pressureSim} onPress={() => onChange({ pressureSim: !settings.pressureSim })} />}
          {meta.usesWet && <Toggle label="Wet" Icon={WetIcon} checked={settings.wetPaint} onPress={() => onChange({ wetPaint: !settings.wetPaint })} />}
          {meta.usesBuildUp && <Toggle label="Build-up" Icon={BuildUpIcon} checked={settings.buildUp} onPress={() => onChange({ buildUp: !settings.buildUp })} />}
        </View>
      )}
    </View>
  )
}

function ShapePicker({ value, onChange }: { value: BrushShape; onChange: (s: BrushShape) => void }) {
  return (
    <View className="flex-row items-center gap-2 py-0.5">
      <Text className="w-[52px] text-xs font-semibold text-muted-foreground">Shape</Text>
      {(['circle', 'square'] as BrushShape[]).map((sh) => {
        const active = value === sh
        return (
          <Pressable key={sh} onPress={() => onChange(sh)} className={cn('flex-1 flex-row items-center justify-center gap-2 rounded-lg py-1.5', active ? 'bg-primary/15' : 'bg-secondary')}>
            <View className={cn('h-4 w-4', sh === 'circle' && 'rounded-full')} style={{ backgroundColor: active ? PRIMARY : MUTED }} />
            <Text className={cn('text-xs', active ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{sh === 'circle' ? 'Circle' : 'Square'}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function Toggle({ label, Icon, checked, onPress }: { label: string; Icon: (p: { size?: number; color?: string }) => React.ReactElement; checked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={cn('flex-row items-center gap-1.5 rounded-xl px-2.5 py-1.5', checked ? 'bg-primary/15' : 'bg-secondary')}>
      <Icon size={15} color={checked ? PRIMARY : MUTED} />
      <Text className={cn('text-xs', checked ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</Text>
    </Pressable>
  )
}
