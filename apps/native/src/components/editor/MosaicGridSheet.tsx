import { useEffect, useState } from 'react'
import { View, Pressable, ActivityIndicator } from 'react-native'
import { getTilesForCanvas, type Tile, type Canvas } from '@drawie/data'
import { Text } from '../ui/text'
import { cn } from '../../lib/cn'
import { CloseIcon } from '../icons'
import { tokenColors } from '../../theme/tokenColors'

/**
 * "View the whole mosaic while drawing" (#2) — a full-screen overlay mirroring the web MosaicReveal:
 * the canvas grid with each tile coloured by status (done / drawing / empty) and YOUR tile ringed.
 * Square tiles, the whole mosaic fit to the area. Tiles are fetched live when opened.
 */
export function MosaicGridSheet({
  canvasId, canvas, userTile, onClose,
}: {
  canvasId: string
  canvas?: Canvas
  userTile?: Tile
  onClose: () => void
}) {
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  const [area, setArea] = useState({ w: 0, h: 0 })

  useEffect(() => {
    let alive = true
    getTilesForCanvas(canvasId).then((t) => { if (alive) setTiles(t) }).catch(() => { if (alive) setTiles([]) })
    return () => { alive = false }
  }, [canvasId])

  const cols = canvas?.gridCols ?? (tiles?.length ? Math.max(...tiles.map((t) => t.col)) + 1 : 1)
  const rows = canvas?.gridRows ?? (tiles?.length ? Math.max(...tiles.map((t) => t.row)) + 1 : 1)
  const byPos = new Map((tiles ?? []).map((t) => [`${t.row}:${t.col}`, t]))
  const done = (tiles ?? []).filter((t) => t.status === 'completed').length
  const fitW = area.w > 0 && area.h > 0 ? Math.min(area.w, (area.h - 16) * (cols / rows)) : area.w

  return (
    <View pointerEvents="auto" className="absolute inset-0 z-50 bg-background/95 px-4 pb-4 pt-3">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mosaic</Text>
          <Text className="text-base font-bold text-foreground">{done}/{cols * rows} tiles done</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8} className="h-10 w-10 items-center justify-center rounded-xl bg-secondary">
          <CloseIcon size={20} color={tokenColors.foreground} />
        </Pressable>
      </View>

      {tiles === null ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={tokenColors.primary} /></View>
      ) : (
        <View className="flex-1 items-center justify-center" onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          <View style={{ width: fitW || '100%' }} className="overflow-hidden rounded-2xl bg-secondary p-2">
            <View className="flex-row flex-wrap">
              {Array.from({ length: rows * cols }).map((_, i) => {
                const r = Math.floor(i / cols)
                const c = i % cols
                const t = byPos.get(`${r}:${c}`)
                const mine = !!userTile && userTile.row === r && userTile.col === c
                const fill = t?.status === 'completed' ? 'bg-emerald-500'
                  : t?.status === 'in-progress' ? 'bg-emerald-400'
                    : 'bg-background'
                return (
                  <View key={i} className="aspect-square p-[1.5px]" style={{ width: `${100 / cols}%` }}>
                    <View className={cn('flex-1 rounded-[3px]', fill, mine && 'border-2 border-primary')} />
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}

      <View className="flex-row items-center justify-center gap-4 pt-2">
        <Legend swatch="bg-emerald-500" label="Done" />
        <Legend swatch="bg-emerald-400" label="Drawing" />
        <Legend swatch="border border-border bg-background" label="Empty" />
        <Legend swatch="border-2 border-primary" label="Your tile" />
      </View>
    </View>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('h-3 w-3 rounded-[3px]', swatch)} />
      <Text className="text-[11px] font-medium text-muted-foreground">{label}</Text>
    </View>
  )
}
