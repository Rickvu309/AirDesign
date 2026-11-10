import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { replay, settleRun } from "./judge-proof.mjs"
import { againSuffix, renderName } from "./pptx-render.mjs"
import { scoreWrittenRoute } from "./pptx-route-judge.mjs"

export const rotatingDecks = 2

const realDeckBytes = 100_000
const fixturesOf = (root) => path.join(root, "scripts/pptx-fixtures")

const corpusFolder = (root) => path.join(fixturesOf(root), "corpus")
const browserExports = ["exported-deck.pptx", "exported-paragraphs.pptx"]
const notOpened = "open: "

export const validatorList = (row) => (row.opened === "ok" ? row.list : [`${notOpened}${row.opened}`])

const caseNames = (root) => {
  const cases = JSON.parse(fs.readFileSync(path.join(fixturesOf(root), "cases.json"), "utf8"))
  return [...new Set(cases.flatMap((row) => [row.before, row.after]))]
}

const topLevelDecks = (root) => fs.readdirSync(fixturesOf(root)).filter((name) => name.endsWith(".pptx"))

const realDeck = (root, name) => fs.statSync(path.join(fixturesOf(root), name)).size >= realDeckBytes

export const refusedEntries = ({ entries, taken }) => {
  const seen = new Set(taken)
  return entries.flatMap((entry) => {
    if (seen.has(entry.name)) return [entry.name]
    seen.add(entry.name)
    return []
  })
}

export const readCorpus = (root) => {
  const file = path.join(fixturesOf(root), "corpus.json")
  if (!fs.existsSync(file)) return []
  const entries = JSON.parse(fs.readFileSync(file, "utf8"))
  const refused = refusedEntries({ entries, taken: [...caseNames(root), ...topLevelDecks(root), ...browserExports] })
  if (refused.length > 0) {
    throw new Error(`corpus.json cannot list ${refused.join(", ")}. A listed name must be new and appear once.`)
  }
  return entries
}

export const judgedDecks = (root) => [
  ...caseNames(root).filter((name) => realDeck(root, name)),
  ...readCorpus(root).map((deck) => deck.name),
]

export const corpusInputs = (root) => ({
  listed: readCorpus(root).map((deck) => deck.name),
  every: judgedDecks(root),
  fixed: topLevelDecks(root)
    .filter((name) => realDeck(root, name))
    .sort(),
})

export const committedArgs = (tree) => ["ls-tree", "-r", tree, "scripts/pptx-fixtures/"]

export const corpusHashFailures = (root) =>
  readCorpus(root).flatMap((deck) => {
    const file = path.join(corpusFolder(root), deck.name)
    if (!fs.existsSync(file)) return [`${deck.name} is listed and has no file.`]
    const found = createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    return found === deck.sha256 ? [] : [`${deck.name} is ${found} and corpus.json says ${deck.sha256}.`]
  })

export const rotatingSubset = ({ names, size, seed }) =>
  Array.from({ length: Math.min(size, names.length) }, (_, step) => names[(seed + step) % names.length])

export const afterRender = (row) => (row.before === row.after ? `${row.after}${againSuffix}` : row.after)

export const rendersOf = ({ cases, added }) => [
  ...new Set([...cases.flatMap((row) => [row.before, afterRender(row)]), ...added]),
]

export const corpusDecision = ({ argv, seeds, listed, every, fixed, cases, browser, size = rotatingDecks }) => {
  const full = argv.includes("--corpus")
  const { seed, fresh } = seeds.at(-1)
  const chosen = full ? every : rotatingSubset({ names: listed, size, seed })
  const added = chosen.filter((name) => listed.includes(name))
  const routeDecks = [...new Set([...fixed, ...chosen])]
  const hardDecks = routeDecks.filter((name) => !listed.includes(name))
  return {
    full,
    seed,
    routeDecks,
    added,
    hardDecks,
    hardOf: (decks) => decks.filter((deck) => hardDecks.includes(deck.name)),
    deckPath: (name) => path.join("scripts/pptx-fixtures", listed.includes(name) ? "corpus" : "", name),
    renderFailure: (render, error) => {
      if (!full || !added.includes(render)) throw error
      return { pages: [], line: `corpus render ${render}: ${error.message}` }
    },
    duration: (measure) => (full ? { line: "the corpus check has no duration limit", fails: false } : measure()),
    renders: rendersOf({ cases, added: full ? added : [] }).filter((render) => renderName(render) !== browser),
    rendersAdded: full,
    excusable: !full && fresh,
    announce: full
      ? `corpus every deck, ${every.length} decks`
      : `corpus rotating ${added.length} of ${listed.length} decks, ${replay(seed)}`,
  }
}

const unopened = (list) => list === undefined || list.some((line) => line.startsWith(notOpened))

const writeMisses = ({ pptx, deck, lists }) =>
  deck.written.flatMap((item) => {
    const after = item.file === null ? undefined : lists.get(path.basename(item.file))
    const failure = scoreWrittenRoute(pptx, deck.deckParts, lists.get(deck.name), item, after)
    return failure === null ? [] : [{ deck: deck.name, ...failure }]
  })

export const corpusMisses = ({ pptx, decks, lists, rendered, rendersAdded }) =>
  decks.flatMap((deck) => [
    ...(!rendersAdded || rendered.get(deck.name)?.length > 0 ? [] : [{ deck: deck.name, render: "no pages" }]),
    ...(unopened(lists.get(deck.name))
      ? [{ deck: deck.name, validator: lists.get(deck.name)?.[0] ?? "no row" }]
      : writeMisses({ pptx, deck, lists })),
  ])

export const corpusLines = ({ misses, full, seed }) =>
  misses.map(
    (miss) => `corpus miss ${JSON.stringify(miss)}, ${full ? "replay with pnpm check:pptx:corpus" : replay(seed)}`,
  )

export const corpusResult = ({ decision, pptx, decks, lists, rendered, freshFails }) => {
  const judged = decks.filter((deck) => decision.added.includes(deck.name))
  const misses = corpusMisses({ pptx, decks: judged, lists, rendered, rendersAdded: decision.rendersAdded })
  const lines = corpusLines({ misses, full: decision.full, seed: decision.seed })
  return {
    ...settleRun({ run: { fresh: decision.excusable }, lines, freshFails }),
    judged: judged.length,
    misses: misses.length,
  }
}

export const checkFails = ({ failed, routeFailures, duration, corpus }) =>
  failed + corpus.failed > 0 || routeFailures.length > 0 || duration.fails
