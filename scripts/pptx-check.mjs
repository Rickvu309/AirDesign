import { execFile } from "node:child_process"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { missingOperations, passedWrites, scoreWrittenRoute, writtenRouteFiles } from "./pptx-route-judge.mjs"
import { timeStick } from "./sticks.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const checkStarted = Date.now()
const dotnet = process.env.PPTX_DOTNET ?? "dotnet"
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const fixtures = path.join(root, "scripts/pptx-fixtures")

const run = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { cwd: root, env: process.env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error((stderr || stdout || `${command} failed`).trim()))
      else resolve(stdout)
    })
  })

const validatorLists = async (files) => {
  const lists = new Map()
  const output = await run(dotnet, ["run", "--project", "scripts/pptx-judge", "-v", "q", "--", ...files])
  for (const line of output.split("\n")) {
    if (!line.startsWith("{")) continue
    const row = JSON.parse(line)
    lists.set(row.file, row.opened === "ok" ? row.list : [`open: ${row.opened}`])
  }
  return lists
}

const renderPages = async (file) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-page-"))
  const out = path.join(dir, "out")
  fs.mkdirSync(out)
  await run(soffice, [
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
  await run("pdftoppm", ["-png", path.join(out, pdf), path.join(dir, "page")])
  const hashes = fs
    .readdirSync(dir)
    .filter((name) => /^page-\d+\.png$/.test(name))
    .sort((left, right) => Number(/\d+/.exec(left)?.[0]) - Number(/\d+/.exec(right)?.[0]))
    .map((name) =>
      createHash("sha256")
        .update(fs.readFileSync(path.join(dir, name)))
        .digest("hex"),
    )
  fs.rmSync(dir, { recursive: true, force: true })
  return hashes
}

await run("pnpm", ["--filter", "@airdesign/pptx", "build"])
const pptx = await import(pathToFileURL(path.join(root, "packages/pptx/dist/index.js")).href)
const require = createRequire(path.join(root, "packages/pptx/package.json"))
await pptx.prepareMarkup(fs.readFileSync(require.resolve("sax-wasm/lib/sax-wasm.wasm")))
const cases = JSON.parse(fs.readFileSync(path.join(fixtures, "cases.json"), "utf8"))
const names = [...new Set(cases.flatMap((row) => [row.before, row.after]))]
const fixturePath = (name) => path.join(fixtures, name)
const routeFixture = "routes.pptx"
const routeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-route-"))
const routeParts = await pptx.readParts(fs.readFileSync(fixturePath(routeFixture)))
const written = await writtenRouteFiles(pptx, routeParts, routeDir, "route")
const routeFiles = written.flatMap((item) => (item.file === null ? [] : [item.file]))
const secondRender = (name) => `${name} again`
const afterRender = (row) => (row.before === row.after ? secondRender(row.after) : row.after)
const waiting = [...new Set(cases.flatMap((row) => [row.before, afterRender(row)]))]
const rendered = new Map()
const renderNext = async () => {
  for (let render = waiting.shift(); render !== undefined; render = waiting.shift()) {
    const name = render.endsWith(" again") ? render.slice(0, -" again".length) : render
    rendered.set(render, await renderPages(fixturePath(name)))
  }
}
const [lists] = await Promise.all([
  validatorLists([...names.map(fixturePath), fixturePath(routeFixture), ...routeFiles]),
  ...Array.from({ length: Math.min(os.availableParallelism(), 4) }, renderNext),
])
const parts = new Map()
for (const name of names) parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
const ids = new Map([...parts].map(([name, packageParts]) => [name, pptx.shapeIdCounts(packageParts)]))
let failed = 0
const routeFailures = []
const missing = missingOperations(
  pptx,
  written.map((item) => item.run),
)
for (const operation of missing) routeFailures.push({ operation, missing: true })
const routeBefore = lists.get(routeFixture)
const judgedRuns = []
for (const item of written) {
  const afterErrors = item.file === null ? undefined : lists.get(path.basename(item.file))
  const failure = scoreWrittenRoute(pptx, routeParts, routeBefore ?? [], item, afterErrors)
  if (failure !== null) routeFailures.push(failure)
  judgedRuns.push({ route: item.run.route, passed: failure === null })
}
const counted = passedWrites([{ runs: judgedRuns, missing: missing.length > 0 }])
const recorded = JSON.parse(fs.readFileSync(path.join(root, "sticks.json"), "utf8"))
const stickDrift = []
const routeNow = recorded["routes pptx writes"]?.now
const deckNow = recorded["real decks in the PowerPoint check"]?.now
if (routeNow !== counted.routes) {
  stickDrift.push(`routes pptx writes is ${counted.routes} and sticks.json says ${routeNow}.`)
}
if (deckNow !== counted.decks) {
  stickDrift.push(`real decks in the PowerPoint check is ${counted.decks} and sticks.json says ${deckNow}.`)
}
fs.rmSync(routeDir, { recursive: true, force: true })
for (const row of cases) {
  const errors = pptx.newValidatorErrors(lists.get(row.before), lists.get(row.after))
  const dupes = pptx.newDuplicateShapeIds(ids.get(row.before), ids.get(row.after))
  const pages = pptx.exactPageCheck({
    before: rendered.get(row.before),
    after: rendered.get(afterRender(row)),
    targeted: row.targeted,
    visible: row.visible,
  })
  if (errors.length !== row.errors || dupes.length !== row.dupes || pages !== row.pages) {
    failed += 1
    console.log(JSON.stringify({ name: row.name, errors: errors.length, dupes: dupes.length, pages }))
  }
}
for (const failure of routeFailures) console.log(JSON.stringify(failure))
for (const line of stickDrift) console.log(line)
const checkSeconds = timeStick(root, "PowerPoint check seconds", checkStarted)
console.log(checkSeconds.line)
if (checkSeconds.over !== undefined) console.log(checkSeconds.over)
if (failed > 0) console.log(`${failed} pptx checks failed`)
else console.log(`${cases.length} pptx checks passed`)
if (routeFailures.length > 0) console.log(`${routeFailures.length} route writes failed`)
else console.log(`${pptx.routeOperations.length} route writes passed`)
if (failed > 0 || routeFailures.length > 0 || stickDrift.length > 0 || checkSeconds.fails) process.exit(1)
