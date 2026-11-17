import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { corpusEditLines, corpusEditsEnv, readCorpusEdits, writeCorpusEdits } from "./corpus-edits.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const pptx = {
  newValidatorErrors: (before, after, copies) => {
    const expected = [...before, ...[...copies].flatMap(([copy]) => before.map((line) => `${line} ${copy}`))]
    return after.filter((line) => !expected.includes(line))
  },
}

const row = { deck: "a.pptx", edit: "type", file: "/tmp/out/a--type.pptx", copies: [["s9", "s1"]] }

same(
  "names a corpus edit whose export adds a validator error",
  corpusEditLines({
    pptx,
    rows: [row],
    lists: new Map([
      ["a.pptx", ["old"]],
      ["a--type.pptx", ["old", "new"]],
    ]),
  }),
  ["corpus edit a.pptx type: 1 new validator errors, first new"],
)
same(
  "lets a copied slide keep the errors its source had",
  corpusEditLines({
    pptx,
    rows: [row],
    lists: new Map([
      ["a.pptx", ["old"]],
      ["a--type.pptx", ["old", "old s9"]],
    ]),
  }),
  [],
)
same(
  "names a corpus edit the validator did not answer",
  corpusEditLines({ pptx, rows: [row], lists: new Map([["a.pptx", []]]) }),
  ["corpus edit a.pptx type: no validator answer"],
)
same(
  "tells the test which decks to edit and where to write",
  corpusEditsEnv({ env: { KEEP: "1" }, decks: ["/x/a.pptx", "/x/b.pptx"], directory: "/out" }),
  { KEEP: "1", CORPUS_EDITS_DECKS: "/x/a.pptx,/x/b.pptx", CORPUS_EDITS_OUT: "/out" },
)

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-edits-"))
try {
  fs.writeFileSync(path.join(folder, "b.json"), JSON.stringify([{ deck: "b.pptx" }]))
  fs.writeFileSync(path.join(folder, "a.json"), JSON.stringify([{ deck: "a.pptx" }]))
  fs.writeFileSync(path.join(folder, "a--type.pptx"), "")
  same("reads every deck's written edits in order", readCorpusEdits(folder), [{ deck: "a.pptx" }, { deck: "b.pptx" }])

  same(
    "edits nothing outside the full corpus check",
    await writeCorpusEdits({ full: false, root: folder, decks: ["a.pptx"], directory: folder, run: () => refuseRun() }),
    { rows: [], failure: null },
  )
  const failed = await writeCorpusEdits({
    full: true,
    root: folder,
    decks: ["a.pptx"],
    directory: folder,
    run: async ({ env }) => {
      fs.writeFileSync(path.join(env.CORPUS_EDITS_OUT, "a.json"), JSON.stringify([{ deck: "a.pptx" }]))
      return { ok: false, output: "type: changed ppt/slides/slide2.xml\n" }
    },
  })
  same("keeps the rows a failed run wrote", failed.rows, [{ deck: "a.pptx" }])
  same(
    "says how to replay a failed run",
    failed.failure,
    "corpus edits break a deck, replay with pnpm check:pptx:corpus\ntype: changed ppt/slides/slide2.xml",
  )
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

function refuseRun() {
  throw new Error("the corpus edits ran outside the full corpus check")
}
