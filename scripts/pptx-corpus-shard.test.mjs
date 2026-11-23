import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { loadCases } from "./pptx-cases.mjs"
import {
  checkFails,
  corpusCaseShares,
  corpusCases,
  corpusDecision,
  corpusInputs,
  corpusPartition,
} from "./pptx-corpus.mjs"
import { readSpecSeconds, specFolder, unrecordedSeconds } from "./spec-seconds.mjs"

const repoRoot = fileURLToPath(new URL("..", import.meta.url))
const same = (name, actual, expected) => assert.deepEqual(actual, expected, name)
const thrownBy = (run) => {
  try {
    run()
  } catch (error) {
    return error
  }
}

const allInputs = corpusInputs(repoRoot)
const halves = [1, 2].map((shard) => corpusPartition({ argv: ["--corpus", `--shard=${shard}/2`], ...allInputs }))
same(
  "each route deck is judged exactly once",
  halves.flatMap((half) => half.routeDecks).sort(),
  [...new Set([...allInputs.fixed, ...allInputs.every])].sort(),
)
same(
  "fixed work runs exactly once",
  halves.map((half) => half.fixedWork),
  [true, false],
)
same(
  "the browser runner carries no listed decks",
  halves[0].routeDecks.some((name) => allInputs.listed.includes(name)),
  false,
)
same("unsharded corpus keeps every route", corpusPartition({ argv: ["--corpus"], ...allInputs }), {
  fixedWork: true,
  routeDecks: [...new Set([...allInputs.fixed, ...allInputs.every])],
})
for (const argv of [["--shard=1/2"], ["--corpus", "--shard=0/2"], ["--corpus", "--shard=1/3"]]) {
  same(
    "invalid shard cannot silently omit work",
    thrownBy(() => corpusPartition({ argv, ...allInputs })) instanceof Error,
    true,
  )
}

const halvesDecisions = [1, 2].map((shard) =>
  corpusDecision({
    argv: ["--corpus", `--shard=${shard}/2`],
    ...allInputs,
    seeds: [{ seed: 1, fresh: true }],
    cases: [{ before: "clean.pptx", after: "clean.pptx" }],
    browser: "browser.pptx",
  }),
)
same(
  "all listed decks are judged once",
  halvesDecisions.flatMap((half) => half.added).sort(),
  [...allInputs.listed].sort(),
)
same(
  "fixed renders run only in the first shard",
  halvesDecisions.map((half) => half.renders.includes("clean.pptx again")),
  [true, false],
)
for (const failed of [0, 1]) {
  same(
    "a failed half fails its verdict",
    checkFails({ failed: 0, routeFailures: [], duration: { fails: false }, corpus: { failed } }),
    failed > 0,
  )
}

const entries = await loadCases(repoRoot)
const exported = readSpecSeconds(repoRoot).export
const caseHalves = [1, 2].map((shard) =>
  corpusCases({ argv: ["--corpus", `--shard=${shard}/2`], entries, seconds: exported }),
)
same(
  "each case entry runs in exactly one corpus shard",
  caseHalves.flatMap((half) => half.map((entry) => entry.file)).sort(),
  entries.map((entry) => entry.file).sort(),
)
assert.ok(
  caseHalves[0].filter((entry) => (entry.specs ?? []).length === 0).length ===
    entries.filter((entry) => (entry.specs ?? []).length === 0).length,
  "an entry that writes its files with no browser spec stays with the fixed work",
)
const specsOf = (half) => new Set(half.flatMap((entry) => entry.specs ?? []))
const [first, second] = caseHalves.map(specsOf)
assert.ok(
  [...first].every((spec) => !second.has(spec)),
  "a browser spec runs in one corpus shard, with every entry that shares it",
)
assert.deepEqual(corpusCases({ argv: ["--corpus"], entries, seconds: exported }), entries)
assert.deepEqual(corpusCases({ argv: [], entries, seconds: exported }), entries)
for (const seconds of [exported, {}]) {
  const weigh = unrecordedSeconds(seconds)
  const heaviest = Math.max(
    0,
    ...entries.flatMap((entry) => entry.specs ?? []).map((spec) => weigh(spec.slice(`${specFolder}/`.length))),
  )
  const { loads } = corpusCaseShares({ entries, seconds })
  assert.ok(
    Math.abs(loads[0] - loads[1]) <= heaviest,
    `the export specs split evenly with ${Object.keys(seconds).length} recorded`,
  )
}
const unknown = { file: "unknown.mjs", specs: ["tests/browser/unknown.spec.ts"], exports: ["exported-unknown.pptx"] }
const withUnknown = [1, 2].map((shard) =>
  corpusCases({ argv: ["--corpus", `--shard=${shard}/2`], entries: [...entries, unknown], seconds: exported }),
)
assert.equal(withUnknown.flat().filter((entry) => entry === unknown).length, 1, "a new entry lands in one shard")
