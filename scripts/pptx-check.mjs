import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dotnet = process.env.PPTX_DOTNET ?? "dotnet"
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const fixtures = path.join(root, "scripts/pptx-fixtures")

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", env: process.env })
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || `${command} failed`).trim())
  return result.stdout
}

const validatorLists = (files) => {
  const lists = new Map()
  const output = run(dotnet, ["run", "--project", "scripts/pptx-judge", "-v", "q", "--", ...files])
  for (const line of output.split("\n")) {
    if (!line.startsWith("{")) continue
    const row = JSON.parse(line)
    lists.set(row.file, row.opened === "ok" ? row.list : [`open: ${row.opened}`])
  }
  return lists
}

const pageHashes = (file) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-page-"))
  const out = path.join(dir, "out")
  fs.mkdirSync(out)
  run(soffice, [
    `-env:UserInstallation=file://${path.join(dir, "profile")}`,
    "--headless",
    "--norestore",
    "--convert-to",
    "pdf",
    "--outdir",
    out,
    file,
  ])
  const pdf = fs.readdirSync(out).find((name) => name.endsWith(".pdf"))
  if (pdf === undefined) throw new Error(file)
  run("pdftoppm", ["-png", path.join(out, pdf), path.join(dir, "page")])
  return fs
    .readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((left, right) => Number(/\d+/.exec(left)?.[0]) - Number(/\d+/.exec(right)?.[0]))
    .map((name) =>
      createHash("sha256")
        .update(fs.readFileSync(path.join(dir, name)))
        .digest("hex"),
    )
}

run("pnpm", ["--filter", "@airdesign/pptx", "build"])
const pptx = await import(pathToFileURL(path.join(root, "packages/pptx/dist/index.js")).href)
const cases = JSON.parse(fs.readFileSync(path.join(fixtures, "cases.json"), "utf8"))
const names = [...new Set(cases.flatMap((row) => [row.before, row.after]))]
const fixturePath = (name) => path.join(fixtures, name)
const lists = validatorLists(names.map(fixturePath))
const parts = new Map()
for (const name of names) parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
const ids = new Map([...parts].map(([name, packageParts]) => [name, pptx.shapeIdCounts(packageParts)]))
let failed = 0
for (const row of cases) {
  const errors = pptx.newValidatorErrors(lists.get(row.before), lists.get(row.after))
  const dupes = pptx.newDuplicateShapeIds(ids.get(row.before), ids.get(row.after))
  const pages = pptx.exactPageCheck({
    before: pageHashes(fixturePath(row.before)),
    after: pageHashes(fixturePath(row.after)),
    targeted: row.targeted,
    visible: row.visible,
  })
  if (errors.length !== row.errors || dupes.length !== row.dupes || pages !== row.pages) {
    failed += 1
    console.log(JSON.stringify({ name: row.name, errors: errors.length, dupes: dupes.length, pages }))
  }
}
if (failed > 0) {
  console.log(`${failed} pptx checks failed`)
  process.exit(1)
}
console.log(`${cases.length} pptx checks passed`)
