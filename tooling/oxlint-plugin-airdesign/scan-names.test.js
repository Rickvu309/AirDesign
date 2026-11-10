import fs from "node:fs"
import path from "node:path"
import { nameFindings } from "./scan-names.js"
import { glossary, wordFindings } from "./scan-names.js"

const expectHits = (relative, count) => {
  const hits = nameFindings(relative)
  if (hits.length !== count) throw new Error(`${relative} gave ${hits.length} hits\n${hits.join("\n")}`)
  return hits
}

const past = expectHits("apps/web/src/lib/utils.ts", 1)
if (past[0] !== "apps/web/src/lib/utils.ts: Rename utils.ts after what it contains.") throw new Error(past[0])
expectHits("packages/document/src/helpers/order.ts", 1)
expectHits("apps/web/src/common.test.tsx", 1)
expectHits("apps/web/src/lib/Utils.ts", 1)
expectHits("apps/web/src/lib/class-names.ts", 0)
expectHits("apps/web/src/editor/commonplace.ts", 0)
expectHits("packages/pptx/src/shape-utils.ts", 0)

const expectWords = (relative, source, said) => {
  const hits = wordFindings(relative, source)
  if (hits.join("\n") !== said.join("\n")) throw new Error(`${relative} gave\n${hits.join("\n")}`)
}

const oldFailure = "known " + "fa" + "ult"
const oldMetric = "st" + "ick"
const oldCi = "ga" + "te"
const oldRatchet = `owner ${oldCi}`
const oldRegression = "old " + "pro" + "of"
const instead = (relative, line, use, old) => `${relative}:${line}: Write "${use}" instead of "${old}".`

expectWords("scripts/metrics.mjs", `  throw new Error("one ${oldFailure} was not counted")`, [
  instead("scripts/metrics.mjs", 1, "known failure", oldFailure),
])
expectWords(
  "AGENTS.md",
  `| A ${oldMetric} moves only toward its goal | the \`${oldRatchet}\` check, run from \`main\` |`,
  [instead("AGENTS.md", 1, "ratchet", oldRatchet), instead("AGENTS.md", 1, "metric", oldMetric)],
)
expectWords("scripts/metrics.mjs", `const ${"known" + "Fa" + "ults"} = (root) => 0`, [
  instead("scripts/metrics.mjs", 1, "known failure", oldFailure),
])
expectWords("scripts/check-regression.mjs", `\n  console.log("no ${oldRegression} could run")`, [
  instead("scripts/check-regression.mjs", 2, "check-regression", oldRegression),
])
expectWords("scripts/check.mjs", `${oldMetric}s and ${oldMetric}`, [
  instead("scripts/check.mjs", 1, "metric", oldMetric),
  instead("scripts/check.mjs", 1, "metric", oldMetric),
])
expectWords("apps/web/src/gated.ts", `export const ${oldCi}d = ${oldMetric}er + investigate + oldMetricsFile`, [])
const ratchetLine = glossary.allowed[0].text
expectWords("scripts/ratchet.mjs", `  ${ratchetLine}`, [])
expectWords("scripts/check.mjs", ratchetLine, [instead("scripts/check.mjs", 1, "metric", oldMetric)])
expectWords("tooling/oxlint-plugin-airdesign/glossary.json", `"${oldMetric}": "metric"`, [])
const pastPath = expectHits(`scripts/${oldMetric}s.mjs`, 1)
if (pastPath[0] !== `scripts/${oldMetric}s.mjs: Write "metric" instead of "${oldMetric}".`) throw new Error(pastPath[0])
expectHits(`.github/workflows/owner-${oldCi}.yml`, 1)

const root = path.resolve(import.meta.dirname, "../..")
for (const one of glossary.allowed) {
  if (!one.reason) throw new Error(`${one.file} has an allowed line with no reason`)
  const lines = fs.readFileSync(path.join(root, one.file), "utf8").split("\n")
  if (!lines.some((line) => line.trim() === one.text)) throw new Error(`${one.file} no longer has ${one.text}`)
}

console.log("scan-names tests passed")
