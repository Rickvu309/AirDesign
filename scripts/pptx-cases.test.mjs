import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { browserExportArgs, browserExportTag, caseExports, caseProblems, caseSpecs, loadCases } from "./pptx-cases.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const entries = await loadCases(root)
assert.deepEqual(
  entries.map((entry) => entry.file),
  [
    "blank.mjs",
    "box.mjs",
    "chart-edits.mjs",
    "diagram-edits.mjs",
    "notes.mjs",
    "paragraphs.mjs",
    "slide-edits.mjs",
    "slide-subset.mjs",
    "slides.mjs",
    "text-format.mjs",
    "text.mjs",
  ],
)
for (const spec of caseSpecs(entries)) assert.ok(fs.existsSync(path.join(root, spec)), `${spec} is not a spec file`)
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
