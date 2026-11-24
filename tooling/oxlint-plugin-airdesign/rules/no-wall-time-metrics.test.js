import { expectAccepts, expectRejects } from "../harness.js"

const rule = { "airdesign/no-wall-time-metrics": "error" }
const message =
  'Read the page\'s engine metrics in thread time: send("Performance.enable", { timeDomain: "threadTicks" }).'
const spec = "tests/browser/editor-speed.spec.ts"

expectRejects(
  "the wall-time idle reading of doom-speed before 2026-11-23 fails",
  spec,
  `export async function enable(device) {\n  await device.send("Performance.enable")\n}\n`,
  rule,
  message,
)
expectRejects(
  "the default time domain named outright fails",
  spec,
  `export async function enable(device) {\n  await device.send("Performance.enable", { timeDomain: "timeTicks" })\n}\n`,
  rule,
  message,
)
expectRejects(
  "options without a time domain fail",
  "scripts/bench.mjs",
  `export async function enable(session) {\n  await session.send(\`Performance.enable\`, {})\n}\n`,
  rule,
  message,
)
expectAccepts(
  "thread time passes",
  spec,
  `export async function enable(device) {\n  await device.send("Performance.enable", { timeDomain: "threadTicks" })\n}\n`,
  rule,
)
expectAccepts(
  "another protocol method passes",
  spec,
  `export async function enable(device) {\n  await device.send("Performance.getMetrics")\n}\n`,
  rule,
)
const speedFiles = [
  "tests/browser/agent-paint.ts",
  "tests/browser/drag-feel.ts",
  "tests/browser/renderer-thread.ts",
  "tests/browser/typed-letter.ts",
  "tests/browser/editor-speed.spec.ts",
]
const clocks = {
  "Date.now": `export const at = () => Date.now()\n`,
  "performance.now": `export const at = () => performance.now()\n`,
  "a pointer timeStamp": `export const at = (event) => event.timeStamp\n`,
  "long-animation-frame": `export const watch = (observer) => observer.observe({ type: "long-animation-frame" })\n`,
  "window.performance.now": `export const at = () => window.performance.now()\n`,
  "a computed timeStamp": `export const at = (event) => event["timeStamp"]\n`,
  "a long-animation-frame template":
    "export const watch = (observer) => observer.observe({ type: `long-animation-frame` })\n",
  "a longtask observer": `export const watch = (observer) => observer.observe({ type: "longtask" })\n`,
}
for (const file of speedFiles) {
  for (const [name, source] of Object.entries(clocks)) {
    expectRejects(`${name} in ${file} fails`, file, source, rule, "Read a speed test's time in renderer thread time")
  }
}
expectAccepts(
  "thread duration of a trace event passes",
  "tests/browser/drag-feel.ts",
  `export const milliseconds = (span) => span.tdur / 1000\n`,
  rule,
)
expectAccepts(
  "a trace marker from console.timeStamp passes, since it reads no clock",
  "tests/browser/editor-speed.spec.ts",
  `export const mark = (label) => console.timeStamp(label)\n`,
  rule,
)
expectAccepts(
  "a clock outside the speed files passes",
  "tests/browser/editor-deck.ts",
  `export const at = () => Date.now() + performance.now()\n`,
  rule,
)
