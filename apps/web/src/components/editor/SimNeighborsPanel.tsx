import { useState } from 'react'
import { readSimConfig, writeSimConfig, restartSim, simAllowed } from '../../lib/simConfig'
import type { SimMode } from '@drawie/data'

/**
 * Dev-only control for the neighbor live-drawing SIMULATION harness. Renders nothing in production
 * (simAllowed() === import.meta.env.DEV). Lets you fake up to 8 neighbors drawing into the slivers
 * without a second user — toggle on, pick a mode + neighbor count, redraw. The hook (useLiveNeighbors)
 * reacts to these changes via the shared simConfig event.
 */
export function SimNeighborsPanel() {
  const [cfg, setCfg] = useState(() => readSimConfig())
  if (!simAllowed()) return null

  const apply = (patch: Partial<typeof cfg>) => {
    const next = { ...cfg, ...patch }
    setCfg(next)
    writeSimConfig(patch)
  }

  return (
    <div
      className="pointer-events-auto fixed bottom-3 left-3 z-[60] flex items-center gap-2 rounded-xl bg-[var(--surface)]/95 px-3 py-2 text-[11px] font-medium text-[var(--foreground)] shadow-lg backdrop-blur"
      style={{ border: '1px solid var(--separator)' }}
    >
      <span className="select-none opacity-60">DEV · neighbors</span>
      <label className="flex items-center gap-1 select-none">
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => apply({ enabled: e.target.checked })} />
        sim
      </label>
      <select
        value={cfg.mode}
        onChange={(e) => apply({ mode: e.target.value as SimMode })}
        className="rounded bg-transparent px-1 py-0.5"
        style={{ border: '1px solid var(--separator)' }}
      >
        <option value="cursor">cursor</option>
        <option value="painting">painting</option>
      </select>
      <label className="flex items-center gap-1 select-none">
        n
        <input
          type="number" min={1} max={8} value={cfg.count}
          onChange={(e) => apply({ count: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })}
          className="w-10 rounded bg-transparent px-1 py-0.5"
          style={{ border: '1px solid var(--separator)' }}
        />
      </label>
      <button
        type="button"
        onClick={() => restartSim()}
        className="rounded px-2 py-0.5"
        style={{ border: '1px solid var(--separator)' }}
        title="Restart the simulation"
      >
        redraw
      </button>
    </div>
  )
}
