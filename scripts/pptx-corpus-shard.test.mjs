import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { checkFails, corpusDecision, corpusInputs, corpusPartition } from "./pptx-corpus.mjs"

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
