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
