import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { replay } from "./judge-proof.mjs"
import { againSuffix } from "./pptx-render.mjs"
import { scoreWrittenRoute } from "./pptx-route-judge.mjs"

export const rotatingDecks = 2

const realDeckBytes = 100_000
const fixturesOf = (root) => path.join(root, "scripts/pptx-fixtures")

export const corpusFolder = (root) => path.join(fixturesOf(root), "corpus")

export const readCorpus = (root) => {
  const file = path.join(fixturesOf(root), "corpus.json")
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : []
}

export const judgedDecks = (root) => {
  const fixtures = fixturesOf(root)
  const cases = JSON.parse(fs.readFileSync(path.join(fixtures, "cases.json"), "utf8"))
  const names = new Set(cases.flatMap((row) => [row.before, row.after]))
  const real = [...names].filter((name) => fs.statSync(path.join(fixtures, name)).size >= realDeckBytes)
  return [...real, ...readCorpus(root).map((deck) => deck.name)]
}

export const corpusHashFailures = (root) =>
  readCorpus(root).flatMap((deck) => {
    const file = path.join(corpusFolder(root), deck.name)
    if (!fs.existsSync(file)) return [`${deck.name} is listed and has no file.`]
    const found = createHash("sha256").update(fs.readFileSync(file)).digest("hex")
    return found === deck.sha256 ? [] : [`${deck.name} is ${found} and corpus.json says ${deck.sha256}.`]
  })

export const rotatingSubset = ({ names, size, seed }) =>
  Array.from({ length: Math.min(size, names.length) }, (_, step) => names[(seed + step) % names.length])

export const corpusPlan = ({ full, every, listed, seed, fresh, size = rotatingDecks }) =>
  full
    ? { decks: every, fresh: false, announce: `corpus every deck, ${every.length} decks` }
    : {
        decks: rotatingSubset({ names: listed, size, seed }),
        fresh,
        announce: `corpus rotating ${Math.min(size, listed.length)} of ${listed.length} decks, ${replay(seed)}`,
      }

export const afterRender = (row) => (row.before === row.after ? `${row.after}${againSuffix}` : row.after)

export const rendersOf = ({ cases, added }) => [
  ...new Set([...cases.flatMap((row) => [row.before, afterRender(row)]), ...added]),
]

export const corpusMisses = ({ pptx, decks, lists, rendered }) =>
  decks.flatMap((deck) => [
    ...(rendered.get(deck.name)?.length > 0 ? [] : [{ deck: deck.name, render: "no pages" }]),
    ...deck.written.flatMap((item) => {
      const after = item.file === null ? undefined : lists.get(path.basename(item.file))
      const failure = scoreWrittenRoute(pptx, deck.deckParts, lists.get(deck.name) ?? [], item, after)
      return failure === null ? [] : [{ deck: deck.name, ...failure }]
    }),
  ])

export const corpusLines = ({ misses, full, seed }) =>
  misses.map(
    (miss) => `corpus miss ${JSON.stringify(miss)}, ${full ? "replay with pnpm check:pptx:corpus" : replay(seed)}`,
  )
