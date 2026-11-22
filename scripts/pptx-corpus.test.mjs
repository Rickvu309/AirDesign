import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { seedFrom, settleRun } from "./judge-proof.mjs"
import {
  afterRender,
  checkFails,
  committedArgs,
  corpusDecision,
  corpusHashFailures,
  corpusInputs,
  corpusMisses,
  corpusResult,
  judgedDecks,
  readCorpus,
  rendersOf,
  rotatingDecks,
  rotatingSubset,
  validatorList,
} from "./pptx-corpus.mjs"
import { committedBlobs, gitBlobId, renderUse } from "./pptx-render.mjs"

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

const decisionCases = [
  { before: "real.pptx", after: "real.pptx" },
  { before: "clean.pptx", after: "text.pptx" },
  { before: "clean.pptx", after: "browser.pptx" },
]
const decide = (argv, seeds) =>
  corpusDecision({
    argv: ["node", "pptx-check.mjs", ...argv],
    seeds,
    listed: names,
    every: ["real.pptx", ...names],
    fixed: ["census.pptx", "real.pptx"],
    cases: decisionCases,
    browser: "browser.pptx",
    size: 2,
  })
const caseRenders = ["real.pptx", "real.pptx again", "clean.pptx", "text.pptx"]
const seedRows = [
  { seed: 9, fresh: false },
  { seed: 1, fresh: true },
]
same("a pull request decides from the last seed, and judges the subset without renders", decide([], seedRows), {
  full: false,
  seed: 1,
  routeDecks: ["census.pptx", "real.pptx", "b.pptx", "c.pptx"],
  added: ["b.pptx", "c.pptx"],
  hardDecks: ["census.pptx", "real.pptx"],
  renders: caseRenders,
  rendersAdded: false,
  excusable: true,
  announce: "corpus rotating 2 of 5 decks, seed 1, replay with JUDGE_SEED=1 pnpm check:pptx",
})
same("the corpus path judges and renders every deck once, and excuses nothing", decide(["--corpus"], seedRows), {
  full: true,
  seed: 1,
  routeDecks: ["census.pptx", "real.pptx", ...names],
  added: names,
  hardDecks: ["census.pptx", "real.pptx"],
  renders: [...caseRenders, ...names],
  rendersAdded: true,
  excusable: false,
  announce: "corpus every deck, 6 decks",
})
same("a replayed seed is not excused", decide([], [{ seed: 1, fresh: false }]).excusable, false)

const pullDecision = decide([], seedRows)
const corpusRun = decide(["--corpus"], seedRows)
const renderBroke = new Error("soffice broke")
const thrownBy = (run) => {
  try {
    run()
    return undefined
  } catch (error) {
    return error
  }
}
same("a render failure on an added deck is a miss on the corpus path", corpusRun.renderFailure("b.pptx", renderBroke), {
  pages: [],
  line: "corpus render b.pptx: soffice broke",
})
same(
  "a render failure on a case deck crashes on the corpus path",
  thrownBy(() => corpusRun.renderFailure("real.pptx", renderBroke)) === renderBroke,
  true,
)
same(
  "a second render failure on a case deck crashes",
  thrownBy(() => corpusRun.renderFailure("real.pptx again", renderBroke)) === renderBroke,
  true,
)
same(
  "a render failure on a case deck crashes on a pull request",
  thrownBy(() => pullDecision.renderFailure("real.pptx", renderBroke)) === renderBroke,
  true,
)
same(
  "a pull request has no render of an added deck to excuse",
  thrownBy(() => pullDecision.renderFailure("b.pptx", renderBroke)) === renderBroke,
  true,
)
same("a listed deck is in the corpus folder", corpusRun.deckPath("b.pptx"), "scripts/pptx-fixtures/corpus/b.pptx")
same("a case deck is in the fixtures folder", corpusRun.deckPath("real.pptx"), "scripts/pptx-fixtures/real.pptx")
const measured = { line: "measured", fails: true }
same(
  "a pull request is timed",
  pullDecision.duration(() => measured),
  measured,
)
same(
  "the corpus path has no duration limit",
  corpusRun.duration(() => measured),
  {
    line: "the corpus check has no duration limit",
    fails: false,
  },
)
same(
  "only the fixed decks are scored as hard",
  corpusRun.hardOf([{ name: "real.pptx" }, { name: "b.pptx" }, { name: "census.pptx" }]),
  [{ name: "real.pptx" }, { name: "census.pptx" }],
)
if (rotatingDecks < 1) throw new Error("the rotating subset is empty")

const packageScripts = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts
same("the corpus command asks for the corpus path", packageScripts["check:pptx:corpus"].endsWith(" --corpus"), true)
same("the pull request command does not", packageScripts["check:pptx"].includes("--corpus"), false)

const checkSource = fs.readFileSync(path.join(repoRoot, "scripts/pptx-check.mjs"), "utf8")
for (const follows of [
  `const decision = corpusDecision({
  argv: process.argv,
  seeds: proofSeeds,
  ...inputs,
  cases,
  browser: textExportName,
})`,
  "const waiting = [...decision.renders]",
  'committedArgs("HEAD")',
  "for (const name of decision.routeDecks)",
  "for (const deck of decision.hardOf(writtenDecks))",
  'decision.duration(() => timeMetric(root, "pptx-check-duration", checkStarted))',
  "decision.renderFailure(render, error)",
  "rendered.set(render, failure.pages)",
  "decision.deckPath(name)",
  "corpusResult({ decision, pptx, decks: writtenDecks, lists, rendered, freshFails })",
  "checkFails({ failed, routeFailures, duration: checkSeconds, corpus })",
  "const entries = corpusCases({ argv: process.argv, entries: allEntries,",
  "exportNames.length > 0\n    ? freshBrowserExport({",
  "validatorFiles({",
  "for (const name of exportNames) parts.set(",
  "for (const line of entry.lines({ pptx, parts, lists, ids, orders })) {",
]) {
  if (!checkSource.includes(follows)) throw new Error(`pptx-check.mjs does not follow the decision: ${follows}`)
}

const validatorSource = fs.readFileSync(path.join(repoRoot, "scripts/pptx-validator.mjs"), "utf8")
if (!validatorSource.includes("validatorList(rows.get(key))")) {
  throw new Error("pptx-validator.mjs does not turn each row into a list with validatorList")
}

const noFailure = { failed: 0, routeFailures: [], duration: { fails: false }, corpus: { failed: 0 } }
same("a clean check passes", checkFails(noFailure), false)
same("a corpus miss fails the check", checkFails({ ...noFailure, corpus: { failed: 1 } }), true)
same("a failed case fails the check", checkFails({ ...noFailure, failed: 1 }), true)
same("a failed route write fails the check", checkFails({ ...noFailure, routeFailures: [{}] }), true)
same("a check twice over its limit fails", checkFails({ ...noFailure, duration: { fails: true } }), true)
let noResult = false
try {
  checkFails({ failed: 0, routeFailures: [], duration: { fails: false } })
} catch {
  noResult = true
}
same("a check with no corpus result cannot pass", noResult, true)

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
  danglingShapeReferences: () => [],
  sharedOwnedParts: () => [],
  partCopies: () => new Map(),
  newSharedOwnedParts: () => [],
  touchMatches: () => true,
  newNotesLinkFailures: () => [],
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
  const decision = corpusDecision({
    argv: full ? ["--corpus"] : [],
    seeds: [{ seed, fresh }],
    listed: names,
    every: names,
    fixed: [],
    cases: [],
    browser: "browser.pptx",
    size: 2,
  })
  const lists = new Map(
    decision.added.flatMap((name) => [
      [name, []],
      [`${name}-text`, name === broken ? ["planted"] : []],
    ]),
  )
  const rendered = new Map(decision.added.map((name) => [name, ["page"]]))
  const settled = corpusResult({ decision, pptx, decks: decision.added.map(written), lists, rendered, freshFails })
  return { settled: { failed: settled.failed, lines: settled.lines } }
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

const renderedNothing = {
  pptx,
  decks: [written("a.pptx")],
  lists: new Map([
    ["a.pptx", []],
    ["a.pptx-text", []],
  ]),
  rendered: new Map([["a.pptx", []]]),
}
same(
  "a deck that renders no pages is a miss on the corpus path",
  corpusMisses({ ...renderedNothing, rendersAdded: true }),
  [{ deck: "a.pptx", render: "no pages" }],
)
same(
  "a deck with no render is no miss on a pull request",
  corpusMisses({ ...renderedNothing, rendersAdded: false }),
  [],
)
same(
  "a render that fails on the corpus path fails the check",
  corpusResult({
    decision: { added: ["a.pptx"], full: true, seed: 1, rendersAdded: true, excusable: false },
    ...renderedNothing,
    freshFails: false,
  }).failed,
  1,
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
    lists: new Map([["a.pptx", []]]),
    rendered: new Map([["a.pptx", ["page"]]]),
    rendersAdded: true,
  }),
  [{ deck: "a.pptx", operation: "text", error: "slides" }],
)

const unopenedLine = validatorList({ file: "a.pptx", opened: "UriFormatException: bad uri" })
same("a deck the validator cannot open has one open line", unopenedLine, ["open: UriFormatException: bad uri"])
same("an opened deck keeps its list", validatorList({ file: "a.pptx", opened: "ok", list: ["kept"] }), ["kept"])
const opening = (lists) => ({
  pptx,
  decks: [written("a.pptx")],
  lists: new Map(lists),
  rendered: new Map([["a.pptx", ["page"]]]),
  rendersAdded: true,
})
same(
  "a listed deck the validator cannot open is a miss before any comparison",
  corpusMisses(
    opening([
      ["a.pptx", unopenedLine],
      ["a.pptx-text", unopenedLine],
    ]),
  ),
  [{ deck: "a.pptx", validator: "open: UriFormatException: bad uri" }],
)
same(
  "a listed deck the validator cannot open is not compared with its writes",
  corpusMisses(
    opening([
      ["a.pptx", unopenedLine],
      ["a.pptx-text", ["a new error"]],
    ]),
  ),
  [{ deck: "a.pptx", validator: "open: UriFormatException: bad uri" }],
)
same("a listed deck with no validator row is a miss", corpusMisses(opening([["a.pptx-text", []]])), [
  { deck: "a.pptx", validator: "no row" },
])
same(
  "a write the validator cannot open is a miss when its deck opened",
  corpusMisses(
    opening([
      ["a.pptx", []],
      ["a.pptx-text", unopenedLine],
    ]),
  ),
  [{ deck: "a.pptx", operation: "text", errors: 1, dupes: 0, parts: true, firstError: unopenedLine[0] }],
)
same(
  "a deck the validator cannot open fails the corpus path",
  corpusResult({
    decision: { added: ["a.pptx"], full: true, seed: 1, rendersAdded: true, excusable: false },
    ...opening([
      ["a.pptx", unopenedLine],
      ["a.pptx-text", unopenedLine],
    ]),
    freshFails: false,
  }).failed,
  1,
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
fs.writeFileSync(path.join(fixtures, "cases.json"), JSON.stringify([{ before: "case.pptx", after: "case.pptx" }]))
fs.writeFileSync(path.join(fixtures, "case.pptx"), "x".repeat(100_000))
fs.writeFileSync(path.join(fixtures, "other.pptx"), "x".repeat(100_000))
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

same("the inputs read the list, the judged decks and the fixed decks", corpusInputs(fake), {
  listed: ["x.pptx", "y.pptx"],
  every: ["case.pptx", "x.pptx", "y.pptx"],
  fixed: ["case.pptx", "other.pptx"],
})
same("the real inputs judge the case decks and the list", corpusInputs(repoRoot).every, judgedDecks(repoRoot))

const refusedList = (entries) => {
  fs.writeFileSync(path.join(fixtures, "corpus.json"), JSON.stringify(entries))
  try {
    readCorpus(fake)
    return undefined
  } catch (error) {
    return error.message
  }
}
const entry = (name) => ({ name, sha256: "0".repeat(64), source: "https://example.gov/deck.pptx" })
same(
  "a listed name already in cases.json is refused",
  refusedList([entry("case.pptx")]),
  "corpus.json cannot list case.pptx. A listed name must be new and appear once.",
)
same(
  "a listed name repeated in the list is refused",
  refusedList([entry("x.pptx"), entry("x.pptx")]),
  "corpus.json cannot list x.pptx. A listed name must be new and appear once.",
)
same(
  "a listed name of a top-level deck is refused",
  refusedList([entry("other.pptx")]),
  "corpus.json cannot list other.pptx. A listed name must be new and appear once.",
)
const casesFile = path.join(fixtures, "cases.json")
const casesText = fs.readFileSync(casesFile, "utf8")
fs.writeFileSync(casesFile, JSON.stringify([{ before: "only-in-cases.pptx", after: "only-in-cases.pptx" }]))
same(
  "a listed name that only cases.json holds is refused",
  refusedList([entry("only-in-cases.pptx")]),
  "corpus.json cannot list only-in-cases.pptx. A listed name must be new and appear once.",
)
fs.writeFileSync(casesFile, casesText)
for (const name of ["exported-deck.pptx", "exported-paragraphs.pptx"]) {
  same(
    `the browser export ${name} is refused`,
    refusedList([entry(name)]),
    `corpus.json cannot list ${name}. A listed name must be new and appear once.`,
  )
}
same("new names are accepted", refusedList([entry("x.pptx"), entry("y.pptx")]), undefined)

execFileSync("git", ["init", "-q"], { cwd: fake })
execFileSync("git", ["add", "-A"], { cwd: fake })
const tree = execFileSync("git", ["write-tree"], { cwd: fake, encoding: "utf8" }).trim()
same(
  "a committed deck in the corpus folder is found, so its render is cached",
  committedBlobs(execFileSync("git", committedArgs(tree), { cwd: fake, encoding: "utf8" })).get("x.pptx"),
  gitBlobId(Buffer.from("changed")),
)

console.log("corpus tests passed")
