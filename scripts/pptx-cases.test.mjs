import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  browserExportArgs,
  browserExportTag,
  caseExports,
  caseOriginals,
  caseProblems,
  caseSpecs,
  caseWritten,
  loadCases,
  writeCases,
} from "./pptx-cases.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const entries = await loadCases(root)
assert.deepEqual(
  entries.map((entry) => entry.file),
  [
    "blank.mjs",
    "box.mjs",
    "chart-edits.mjs",
    "color-picker.mjs",
    "color-transforms.mjs",
    "diagram-edits.mjs",
    "element-order.mjs",
    "frame.mjs",
    "gradient-kept.mjs",
    "group-duplicate.mjs",
    "group-join.mjs",
    "group-transform.mjs",
    "group.mjs",
    "layer-duplicate.mjs",
    "layer-join.mjs",
    "layer-lock.mjs",
    "layer-paste.mjs",
    "mask-cropped.mjs",
    "mask.mjs",
    "new-slide-prompts.mjs",
    "notes.mjs",
    "paragraphs.mjs",
    "picture-adjust.mjs",
    "picture-mode.mjs",
    "section-list.mjs",
    "shapes.mjs",
    "slide-background.mjs",
    "slide-edits.mjs",
    "slide-hidden.mjs",
    "slide-skip.mjs",
    "slide-subset.mjs",
    "slide-transition.mjs",
    "slides.mjs",
    "smart-animate.mjs",
    "template-style.mjs",
    "text-fields.mjs",
    "text-format.mjs",
    "text.mjs",
    "trait-body.mjs",
    "trait-border.mjs",
    "trait-connection.mjs",
    "trait-effects.mjs",
    "trait-fill.mjs",
    "trait-geometry.mjs",
    "trait-link.mjs",
    "trait-opacity.mjs",
    "trait-picture.mjs",
    "trait-table.mjs",
    "trait-text.mjs",
    "trait-theme.mjs",
  ],
)
for (const spec of caseSpecs(entries)) assert.ok(fs.existsSync(path.join(root, spec)), `${spec} is not a spec file`)
for (const entry of entries) {
  for (const row of entry.cases ?? []) {
    assert.equal(typeof row.pages, "boolean", `${entry.file} ${row.name} needs an expected page comparison`)
    if (entry.exports.includes(row.after))
      assert.ok(entry.renders?.includes(row.after), `${entry.file} must render ${row.after} to compare its pages`)
  }
}
assert.equal(new Set(caseExports(entries)).size, caseExports(entries).length)
assert.deepEqual(browserExportArgs(entries).slice(-2), ["--grep", browserExportTag])
assert.deepEqual(browserExportArgs(entries).slice(0, -2), [...new Set(browserExportArgs(entries).slice(0, -2))].sort())

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8")
assert.ok(gitignore.split("\n").includes("tests/browser/exported-*.pptx"), "exports are not ignored by one pattern")

const good = {
  specs: ["tests/browser/box-export.spec.ts"],
  exports: ["exported-box.pptx"],
  lines: () => [],
}
assert.deepEqual(caseProblems("box.mjs", good), [])
assert.match(caseProblems("a.mjs", { ...good, specs: [] })[0], /scripts\/pptx-cases\/a\.mjs needs specs/)
assert.match(caseProblems("a.mjs", { ...good, specs: ["box-export.spec.ts"] })[0], /needs specs/)
assert.match(caseProblems("a.mjs", { ...good, exports: ["box.pptx"] })[0], /needs exports/)
assert.match(caseProblems("a.mjs", { ...good, exports: undefined })[0], /needs exports/)
assert.match(caseProblems("a.mjs", { ...good, lines: undefined })[0], /needs lines/)
assert.match(caseProblems("a.mjs", { ...good, cases: {} })[0], /cases that is not a list/)
assert.match(caseProblems("a.mjs", { ...good, renders: "exported-box.pptx" })[0], /renders that is not a list/)
assert.match(caseProblems("a.mjs", { ...good, originals: "deck.pptx" })[0], /originals that is not a list/)
assert.deepEqual(caseOriginals([{ originals: ["b.pptx", "a.pptx"] }, {}, { originals: ["a.pptx"] }]), [
  "a.pptx",
  "b.pptx",
])
assert.ok(caseOriginals(entries).includes("nasa-cots-electronics.pptx"), "the effects case reads its corpus original")
assert.deepEqual(caseProblems("a.mjs", { ...good, covers: ["box.x", "table.value", "templateStyle.dk1"] }), [])
assert.match(caseProblems("a.mjs", { ...good, covers: "box.x" })[0], /covers that is not a list of trait fields/)
assert.match(caseProblems("a.mjs", { ...good, covers: ["box"] })[0], /covers that is not a list of trait fields/)

const folders = []
process.on("exit", () => {
  for (const folder of folders) fs.rmSync(folder, { recursive: true, force: true })
})
const scenario = (files) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-cases-"))
  folders.push(folder)
  fs.mkdirSync(path.join(folder, "scripts/pptx-cases"), { recursive: true })
  for (const [name, text] of Object.entries(files))
    fs.writeFileSync(path.join(folder, "scripts/pptx-cases", name), text)
  return folder
}
const entryText = (exportName) =>
  `export default { specs: ["tests/browser/x.spec.ts"], exports: ["${exportName}"], lines: () => [] }\n`

await assert.rejects(
  loadCases(scenario({ "one.mjs": entryText("exported-one.pptx"), "two.mjs": entryText("exported-one.pptx") })),
  /two\.mjs writes exported-one\.pptx, which another case writes/,
)
const loaded = await loadCases(
  scenario({
    "one.mjs": entryText("exported-one.pptx"),
    "two.mjs": entryText("exported-two.pptx"),
    "two.test.mjs": "throw new Error('a test is not a case')\n",
  }),
)
assert.deepEqual(caseExports(loaded), ["exported-one.pptx", "exported-two.pptx"])
await assert.rejects(
  loadCases(scenario({ "three.mjs": "export default { specs: [], exports: [], lines: 1 }\n" })),
  /three\.mjs needs specs[\s\S]*three\.mjs needs exports[\s\S]*three\.mjs needs lines/,
)

const writing = { written: ["written-a.pptx"], write: () => [], lines: () => [] }
assert.deepEqual(caseProblems("w.mjs", writing), [])
assert.match(caseProblems("w.mjs", { ...writing, write: undefined })[0], /w\.mjs needs write/)
assert.match(caseProblems("w.mjs", { ...writing, written: ["exported-a.pptx"] })[0], /needs written/)
assert.match(caseProblems("w.mjs", { written: [], lines: () => [] }).join("\n"), /needs write[\s\S]*needs written/)
assert.deepEqual(caseSpecs([writing, good]), good.specs)
assert.deepEqual(caseExports([writing, good]), good.exports)
assert.deepEqual(caseWritten([writing, good]), ["written-a.pptx"])
assert.deepEqual(caseWritten(entries).slice(0, 3), [
  "written-group-duplicate.pptx",
  "written-group-join.pptx",
  "written-group-transform.pptx",
])

const out = scenario({})
const original = new Map([["a", new Uint8Array([1])]])
const fakePptx = {
  exportPackage: async (bytes, parts) => new Uint8Array([...bytes, ...parts.get("a")]),
  readParts: async (bytes) => new Map([["a", bytes]]),
}
const deckParts = new Map([["deck.pptx", original]])
const files = await writeCases({
  pptx: fakePptx,
  entries: [
    { ...good },
    {
      ...writing,
      written: ["written-a.pptx"],
      write: ({ parts }) => [{ name: "written-a.pptx", original: "deck.pptx", parts: parts.get("deck.pptx") }],
    },
  ],
  parts: deckParts,
  original: (name) => (name === "deck.pptx" ? new Uint8Array([9]) : undefined),
  directory: out,
})
assert.deepEqual(files, [path.join(out, "written-a.pptx")])
assert.deepEqual([...fs.readFileSync(files[0])], [9, 1])
assert.deepEqual([...deckParts.get("written-a.pptx").get("a")], [9, 1])
await assert.rejects(
  writeCases({
    pptx: fakePptx,
    entries: [{ ...writing, file: "w.mjs" }],
    parts: deckParts,
    original: () => new Uint8Array(),
    directory: out,
  }),
  /w\.mjs wrote /,
)
