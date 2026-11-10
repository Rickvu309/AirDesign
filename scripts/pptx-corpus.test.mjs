import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { seedFrom, settleRun } from "./judge-proof.mjs"
import {
  afterRender,
  corpusHashFailures,
  corpusLines,
  corpusMisses,
  corpusPlan,
  judgedDecks,
  readCorpus,
  rendersOf,
  rotatingDecks,
  rotatingSubset,
} from "./pptx-corpus.mjs"
import { gitBlobId, renderUse } from "./pptx-render.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const names = ["a.pptx", "b.pptx", "c.pptx", "d.pptx", "e.pptx"]
const commits = Array.from({ length: 64 }, (_, index) => (index * 2654435761).toString(16).padStart(8, "0").repeat(5))
const seeds = commits.map((commit) => seedFrom({ chosen: undefined, commit }))

for (const seed of seeds) {
  same(
    "the same commit picks the same decks",
    rotatingSubset({ names, size: 2, seed }),
    rotatingSubset({ names, size: 2, seed }),
  )
  same("a subset holds its size", new Set(rotatingSubset({ names, size: 2, seed })).size, 2)
}
same(
  "a range of commits covers every deck",
  [...new Set(seeds.flatMap((seed) => rotatingSubset({ names, size: 2, seed })))].sort(),
  names,
)
same("a subset larger than the list stops at the list", rotatingSubset({ names, size: 9, seed: 3 }).length, 5)

const fullPlan = corpusPlan({ full: true, every: ["real.pptx", ...names], listed: names, seed: 1, fresh: true })
same("the corpus path takes every deck", fullPlan.decks, ["real.pptx", ...names])
same("a corpus miss is never excused", fullPlan.fresh, false)
same(
  "the rotating path takes the subset",
  corpusPlan({ full: false, every: names, listed: names, seed: 1, fresh: true, size: 2 }).decks,
  ["b.pptx", "c.pptx"],
)
if (rotatingDecks < 1) throw new Error("the rotating subset is empty")

const renderCases = [
  { before: "real.pptx", after: "real.pptx" },
  { before: "clean.pptx", after: "text.pptx" },
]
same(
  "a judged row keeps two renders and an added deck has one",
  rendersOf({ cases: renderCases, added: ["new.pptx"] }),
  ["real.pptx", "real.pptx again", "clean.pptx", "text.pptx", "new.pptx"],
)
same("an unchanged judged row renders again", afterRender(renderCases[0]), "real.pptx again")
const deckBytes = Buffer.from("deck")
same(
  "an added deck's one render is cached",
  renderUse({ render: "new.pptx", bytes: deckBytes, committed: new Map([["new.pptx", gitBlobId(deckBytes)]]) }),
  "cached",
)

const pptx = {
  newValidatorErrors: (before, after) => after.filter((error) => !before.includes(error)),
  newDuplicateShapeIds: () => [],
  shapeIdCounts: () => new Map(),
  touchMatches: () => true,
}
const written = (name) => ({
  name,
  deckParts: new Map(),
  written: [
    {
      run: { operation: "text", error: null, touch: {} },
      file: `/deck/${name}-text`,
      back: new Map(),
      exportError: null,
    },
  ],
})
const judgedRun = ({ broken, full, seed, fresh, freshFails }) => {
  const plan = corpusPlan({ full, every: names, listed: names, seed, fresh, size: 2 })
  const lists = new Map(
    plan.decks.flatMap((name) => [
      [name, []],
      [`${name}-text`, name === broken ? ["planted"] : []],
    ]),
  )
  const rendered = new Map(plan.decks.map((name) => [name, ["page"]]))
  const misses = corpusMisses({ pptx, decks: plan.decks.map(written), lists, rendered })
  return { plan, settled: settleRun({ run: plan, lines: corpusLines({ misses, full, seed }), freshFails }) }
}

const broken = "c.pptx"
const inside = 1
const outside = 3
same("the planted deck is in this subset", rotatingSubset({ names, size: 2, seed: inside }).includes(broken), true)
same(
  "the planted deck is outside this subset",
  rotatingSubset({ names, size: 2, seed: outside }).includes(broken),
  false,
)

const missed = judgedRun({ broken, full: false, seed: outside, fresh: true, freshFails: true })
same("a break outside the subset is not seen on a pull request", missed.settled, { failed: 0, lines: [] })

const printed = judgedRun({ broken, full: false, seed: inside, fresh: true, freshFails: false })
same("a miss on a pull request with no judge file does not fail", printed.settled.failed, 0)
same("a miss on a pull request with no judge file prints", printed.settled.lines.length, 1)
if (!printed.settled.lines[0].includes(`JUDGE_SEED=${inside}`)) throw new Error("a miss printed no replay line")
if (!printed.settled.lines[0].startsWith("This pull request changes no judge file")) {
  throw new Error("a printed miss does not say why it passes")
}

same(
  "a miss on a judge pull request fails",
  judgedRun({ broken, full: false, seed: inside, fresh: true, freshFails: true }).settled.failed,
  1,
)
same(
  "a replayed seed fails",
  judgedRun({ broken, full: false, seed: inside, fresh: false, freshFails: false }).settled.failed,
  1,
)

const caught = judgedRun({ broken, full: true, seed: outside, fresh: true, freshFails: false })
same("the corpus path catches a break outside the subset", caught.settled.failed, 1)
if (!caught.settled.lines[0].includes("pnpm check:pptx:corpus")) throw new Error("a corpus miss printed no replay line")

same(
  "a deck that renders no pages is a miss",
  corpusMisses({
    pptx,
    decks: [written("a.pptx")],
    lists: new Map([["a.pptx-text", []]]),
    rendered: new Map([["a.pptx", []]]),
  }),
  [{ deck: "a.pptx", render: "no pages" }],
)
same(
  "a refused write on an added deck is a miss",
  corpusMisses({
    pptx,
    decks: [
      {
        name: "a.pptx",
        deckParts: new Map(),
        written: [
          { run: { operation: "text", error: "slides", touch: null }, file: null, back: null, exportError: null },
        ],
      },
    ],
    lists: new Map(),
    rendered: new Map([["a.pptx", ["page"]]]),
  }),
  [{ deck: "a.pptx", operation: "text", error: "slides" }],
)

same("every listed deck matches its sha256", corpusHashFailures(repoRoot), [])
same(
  "every listed deck has a name, sha256 and source",
  readCorpus(repoRoot).filter((deck) => Object.keys(deck).sort().join() !== "name,sha256,source"),
  [],
)
same(
  "the corpus job judges the case decks and the listed decks",
  judgedDecks(repoRoot).length,
  readCorpus(repoRoot).length + 2,
)

const listedDecks = readCorpus(repoRoot).map((deck) => deck.name)
same(
  "a range of commits covers every listed deck",
  [...new Set(seeds.flatMap((seed) => rotatingSubset({ names: listedDecks, size: rotatingDecks, seed })))].sort(),
  [...listedDecks].sort(),
)

const fake = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-corpus-"))
process.on("exit", () => fs.rmSync(fake, { recursive: true, force: true }))
const fixtures = path.join(fake, "scripts/pptx-fixtures")
fs.mkdirSync(path.join(fixtures, "corpus"), { recursive: true })
fs.writeFileSync(path.join(fixtures, "corpus/x.pptx"), "changed")
fs.writeFileSync(
  path.join(fixtures, "corpus.json"),
  JSON.stringify([
    { name: "x.pptx", sha256: "0".repeat(64), source: "https://example.gov/x.pptx" },
    { name: "y.pptx", sha256: "0".repeat(64), source: "https://example.gov/y.pptx" },
  ]),
)
const hashFailures = corpusHashFailures(fake)
same("a changed deck and a missing deck are both named", hashFailures.length, 2)
if (!hashFailures[1].includes("has no file")) throw new Error("a missing deck was not named")

console.log("corpus tests passed")
