import { useRef, useState } from 'react'
import { StyleSheet, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { CASES, runCase, SIZE, type GoldenResult } from './runGolden'

/**
 * Phase 6 golden DEV screen — runs the corpus through RNSkiaBackend on-device and diffs each case
 * against the bundled Canvas2D baseline. Deterministic tools must land within DET_PASS meanAbs;
 * stochastic tools (rng stamps) are reported, not failed (same policy as the web skia-golden runner).
 * Reachable via a long-press on the discovery title — not part of the product UI.
 */
const DET_PASS = 3.0 // meanAbs/255 tolerance for deterministic tools (web Skia got ~0.24 avg, 1.5 worst)
// NOTE: watercolor-dwell-pool reads ~0.253 meanAbs (inkRatio 0 — the pooled pigment sits right at the
// 24/255 ink threshold). That is NOT a native bug: web-Skia/CanvasKit gives the IDENTICAL 0.253 vs the
// Canvas2D baseline (see docs/baseline/PARITY-SKIA.json) — an inherent Skia-vs-Canvas2D delta from 70×
// dwell-pool accumulation. Native actually beats web-Skia on the readback tools (eraser/smudge). Don't
// "fix" it: matching the baseline more here would diverge native from web-Skia, the real parity target.

export function GoldenScreen({ onBack }: { onBack: () => void }) {
  const [results, setResults] = useState<GoldenResult[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const runningRef = useRef(false)

  const run = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true); setResults([]); setDone(0)
    const acc: GoldenResult[] = []
    console.log(`[golden] running ${CASES.length} cases (RN-Skia vs Canvas2D baseline, ${SIZE}²)…`)
    for (const c of CASES) {
      const r = await runCase(c)
      acc.push(r)
      // Stream each verdict to Metro so it can be read off-device. `tag` mirrors the on-screen chip.
      const tag = r.error ? 'ERR ' : r.stochastic ? 'stoch' : r.meanAbs <= DET_PASS ? 'PASS ' : 'FAIL '
      console.log(`[golden] ${tag} ${r.id} meanAbs=${r.meanAbs.toFixed(3)} maxAbs=${r.maxAbs} pctDiff=${r.pctDiff.toFixed(3)} ink=${r.inkA.toFixed(4)}/${r.inkB.toFixed(4)}${r.error ? ' :: ' + r.error : ''}`)
      setResults([...acc]); setDone(acc.length)
      // yield a frame so the table + progress repaint and the JS thread isn't pinned
      await new Promise<void>((res) => requestAnimationFrame(() => res()))
    }
    const detR = acc.filter((r) => !r.stochastic && !r.error)
    const worst = detR.reduce<GoldenResult | null>((m, r) => (!m || r.meanAbs > m.meanAbs ? r : m), null)
    console.log(`[golden] DONE det ${detR.filter((r) => r.meanAbs <= DET_PASS).length}/${detR.length} ≤${DET_PASS} · stoch ${acc.filter((r) => r.stochastic).length} · err ${acc.filter((r) => r.error).length}` +
      (worst ? ` · worst-det ${worst.id}=${worst.meanAbs.toFixed(3)}` : ''))
    setRunning(false)
    runningRef.current = false
  }

  const verdict = (r: GoldenResult) =>
    r.error ? { txt: 'err', style: styles.bad }
      : r.stochastic ? { txt: `~ ${r.meanAbs.toFixed(2)}`, style: styles.info }
        : r.meanAbs <= DET_PASS ? { txt: `✓ ${r.meanAbs.toFixed(2)}`, style: styles.good }
          : { txt: `✗ ${r.meanAbs.toFixed(2)}`, style: styles.bad }

  const det = results.filter((r) => !r.stochastic && !r.error)
  const detPass = det.filter((r) => r.meanAbs <= DET_PASS).length
  const errs = results.filter((r) => r.error).length

  return (
    <View style={styles.fill}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} disabled={running}><Text style={styles.back}>‹ Back</Text></Pressable>
        <Text style={styles.title}>RN-Skia parity</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.bar}>
        <Pressable onPress={run} disabled={running} style={[styles.run, running && styles.runOff]}>
          {running ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.runText}>Run {CASES.length} cases</Text>}
        </Pressable>
        {results.length > 0 && (
          <Text style={styles.summary}>
            det {detPass}/{det.length} ≤{DET_PASS} · stoch {results.filter((r) => r.stochastic).length} · err {errs}
          </Text>
        )}
        {running && <Text style={styles.summary}>{done}/{CASES.length}…</Text>}
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.cId, styles.th]}>case</Text>
          <Text style={[styles.cNum, styles.th]}>max</Text>
          <Text style={[styles.cNum, styles.th]}>%diff</Text>
          <Text style={[styles.cV, styles.th]}>meanAbs</Text>
        </View>
        {results.map((r) => {
          const v = verdict(r)
          return (
            <View key={r.id} style={styles.row}>
              <Text style={styles.cId} numberOfLines={1}>{r.id}</Text>
              <Text style={styles.cNum}>{r.error ? '—' : r.maxAbs}</Text>
              <Text style={styles.cNum}>{r.error ? '—' : r.pctDiff.toFixed(2)}</Text>
              <View style={[styles.cV, styles.vBox, v.style]}><Text style={styles.vText}>{r.error ?? v.txt}</Text></View>
            </View>
          )
        })}
        {results.length === 0 && !running && (
          <Text style={styles.empty}>Diffs each tool's RN-Skia render against the Canvas2D baseline. Runs entirely on device.</Text>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  back: { fontSize: 15, color: '#7c8cff', fontWeight: '600', width: 60 },
  title: { fontSize: 17, fontWeight: '700', color: '#1a1a2e' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  run: { backgroundColor: '#7c8cff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9, minWidth: 120, alignItems: 'center' },
  runOff: { opacity: 0.5 },
  runText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summary: { fontSize: 12, color: '#666', fontWeight: '600', flexShrink: 1 },
  list: { paddingHorizontal: 12, paddingBottom: 30 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  headRow: { borderBottomWidth: 1, borderBottomColor: '#ddd' },
  th: { color: '#999', fontWeight: '700', fontSize: 11 },
  cId: { flex: 1, fontSize: 12, color: '#333' },
  cNum: { width: 52, fontSize: 12, color: '#666', textAlign: 'right', fontVariant: ['tabular-nums'] },
  cV: { width: 86, alignItems: 'flex-end', paddingLeft: 8 },
  vBox: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  vText: { fontSize: 11, fontWeight: '700', color: '#fff', fontVariant: ['tabular-nums'] },
  good: { backgroundColor: '#06d6a0' },
  bad: { backgroundColor: '#ef476f' },
  info: { backgroundColor: '#9aa0a6' },
  empty: { color: '#999', textAlign: 'center', marginTop: 40, paddingHorizontal: 30, lineHeight: 20 },
})
