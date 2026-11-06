import assert from "node:assert/strict"
import { Session } from "node:inspector/promises"
import { PerformanceObserver } from "node:perf_hooks"
import { mkdir, writeFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import os from "node:os"
import { apply } from "../../packages/deck/src/apply.ts"
import { fixtureDeck } from "../../packages/deck/src/fixture.ts"
const root = process.env.P02_OUTPUT ?? `${os.homedir()}/tmp/airdesign-autopilot/P02/perf`
await mkdir(root, { recursive: true })
const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim()
let deck = fixtureDeck(300)
function step() {
  const target = deck.slides[0].elements[1]
  const changes = { changes: [{ kind: "set", target: target.id, value: { ...target, box: { ...target.box, x: target.box.x + 1 } } }] }
  const start = performance.now()
  const result = apply(deck, changes)
  const ms = performance.now() - start
  assert.equal(result.ok, true)
  assert.equal(result.deck.slides[0].elements[1].box.x, target.box.x + 1)
  assert.equal(result.deck.slides[0].elements[2], deck.slides[0].elements[2])
  deck = result.deck
  return ms
}
if (process.argv.includes("--cold")) {
  process.stdout.write(JSON.stringify({ firstApplyMs: step(), elements: 300, endX: deck.slides[0].elements[1].box.x }))
} else {
  const cold = Array.from({ length: 5 }, () => {
    const run = spawnSync("node", ["bench/render/apply-perf.mjs", "--cold"], { encoding: "utf8" })
    assert.equal(run.status, 0, run.stderr)
    return JSON.parse(run.stdout)
  })
  for (let i = 0; i < 100; i++) step()
  const gc = []
  const observer = new PerformanceObserver(list => { for (const entry of list.getEntries()) gc.push({ durationMs: entry.duration, kind: entry.detail.kind }) })
  observer.observe({ entryTypes: ["gc"] })
  const runs = []
  for (let run = 0; run < 5; run++) {
    const samples = Array.from({ length: 200 }, step)
    const sorted = samples.toSorted((a, b) => a - b)
    runs.push({ samples, p95Ms: sorted[190], changedElements: 200 })
  }
  function graph(value, objects = new Set()) {
    if (value && typeof value === "object" && !objects.has(value)) { objects.add(value); for (const item of Object.values(value)) graph(item, objects) }
    return objects
  }
  const before = graph(deck)
  step()
  const retainedNewObjects = [...graph(deck)].filter(value => !before.has(value)).length
  assert.equal(retainedNewObjects, 6)
  const session = new Session()
  session.connect()
  await session.post("Profiler.enable")
  await session.post("Profiler.start")
  await session.post("HeapProfiler.startSampling", { samplingInterval: 256 })
  for (let i = 0; i < 1000; i++) step()
  const allocation = await session.post("HeapProfiler.stopSampling")
  const profile = await session.post("Profiler.stop")
  session.disconnect()
  await new Promise(resolve => setImmediate(resolve))
  observer.disconnect()
  const p95 = Math.max(...runs.map(run => run.p95Ms))
  await writeFile(`${root}/apply-cpu.cpuprofile`, JSON.stringify(profile.profile))
  await writeFile(`${root}/apply-allocation.heapprofile`, JSON.stringify(allocation.profile))
  const value = { head, workload: "300 elements; five independent first applies; 100 warmup then five runs of 200 distinct sets; separate profiled batch of 1000", cold, runs, worstRunP95Ms: p95, budgetMs: 4, verdict: p95 <= 4 ? "pass" : "fail", retainedNewObjects, retainedObjectDefinition: "New reachable deck objects by identity: deck, slides array, slide, elements array, element and box; excludes temporary allocations", gc, peakRssBytes: process.resourceUsage().maxRSS * 1024, allocationProfile: "apply-allocation.heapprofile", cpuProfile: "apply-cpu.cpuprofile", failures: 0 }
  await writeFile(`${root}/apply-detailed.json`, JSON.stringify(value, null, 2))
  process.stdout.write(`${JSON.stringify({ worstRunP95Ms: p95, retainedNewObjects, cold: cold.map(c => c.firstApplyMs), gcEvents: gc.length, peakRssBytes: value.peakRssBytes })}\n`)
}
