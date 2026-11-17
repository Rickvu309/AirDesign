import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export const corpusEditsTest = "apps/web/src/corpus-edits.test.ts"

export const corpusEditsEnv = ({ env, decks, directory }) => ({
  ...env,
  CORPUS_EDITS_DECKS: decks.join(","),
  CORPUS_EDITS_OUT: directory,
})

export const readCorpusEdits = (directory) =>
  fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .flatMap((name) => JSON.parse(fs.readFileSync(path.join(directory, name), "utf8")))

export const corpusEditLines = ({ pptx, rows, lists }) =>
  rows.flatMap((row) => {
    const before = lists.get(row.deck)
    const after = lists.get(path.basename(row.file))
    if (before === undefined || after === undefined) return [`corpus edit ${row.deck} ${row.edit}: no validator answer`]
    const fresh = pptx.newValidatorErrors(before, after, new Map(row.copies))
    if (fresh.length === 0) return []
    return [`corpus edit ${row.deck} ${row.edit}: ${fresh.length} new validator errors, first ${fresh[0]}`]
  })

const vitest = ({ root, env }) =>
  new Promise((resolve) => {
    execFile(
      "pnpm",
      ["exec", "vitest", "run", corpusEditsTest],
      { cwd: root, env, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => resolve({ ok: error === null, output: `${stdout}${stderr}` }),
    )
  })

export const writeCorpusEdits = async ({ full, root, decks, directory, run = vitest }) => {
  if (!full) return { rows: [], failure: null }
  const folder = path.join(directory, "corpus-edits")
  fs.mkdirSync(folder, { recursive: true })
  const ran = await run({ root, env: corpusEditsEnv({ env: process.env, decks, directory: folder }) })
  return {
    rows: readCorpusEdits(folder),
    failure: ran.ok ? null : `corpus edits break a deck, replay with pnpm check:pptx:corpus\n${ran.output.trim()}`,
  }
}
