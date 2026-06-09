interface Props {
  colors: string[]
  size?: number
}

/** Compact horizontal row of color swatches shown on canvas previews. */
export function PalettePreview({ colors, size = 14 }: Props) {
  return (
    <div className="flex items-center gap-1 p-1.5 rounded-full bg-[var(--surface)]/85 backdrop-blur shadow-sm">
      {colors.slice(0, 6).map((c, i) => (
        <span
          key={i}
          className="rounded-full ring-1 ring-black/5"
          style={{ width: size, height: size, background: c }}
        />
      ))}
    </div>
  )
}
