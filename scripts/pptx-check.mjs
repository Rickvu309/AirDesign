import { execFile } from "node:child_process"
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { judge } from "./judge.mjs"
import { plantSamples, proofFailures, proofTable, replay, seedFrom } from "./judge-proof.mjs"
import { timeStick } from "./sticks.mjs"
import { storedZip } from "./stored-zip.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const checkStarted = Date.now()
const dotnet = process.env.PPTX_DOTNET ?? "dotnet"
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const fixtures = path.join(root, "scripts/pptx-fixtures")
const browserExportName = "exported-deck.pptx"
const browserExportPath = path.join(root, "tests/browser", browserExportName)
if (!fs.existsSync(browserExportPath)) {
  console.error("missing tests/browser/exported-deck.pptx")
  process.exit(1)
}

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
cases.push({
  name: "browser-text-export",
  before: "clean.pptx",
  after: browserExportName,
  visible: true,
  targeted: [1],
  errors: 0,
  dupes: 0,
  pages: true,
})
const names = [...new Set(cases.flatMap((row) => [row.before, row.after]))]
const fixturePath = (name) => (name === browserExportName ? browserExportPath : path.join(fixtures, name))
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
const proofStarted = Date.now()
const seed = seedFrom({ chosen: process.env.JUDGE_SEED, commit: await run("git", ["rev-parse", "HEAD"]) })
const proofFile = path.join(fixtures, "judge-proof.json")
const cleanDecks = ["clean.pptx", "nasa-1d-cnn.pptx", "doe-heat-pumps.pptx", "census-updating-spm.pptx"]
const parts = new Map()
for (const name of new Set([...names, ...cleanDecks])) {
  parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
}
const planted = plantSamples({
  pptx,
  decks: cleanDecks.map((name) => ({ name, parts: parts.get(name) })),
  seed,
  samples: Number(process.env.JUDGE_SAMPLES ?? 3),
})
const proofFolder = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-judge-proof-"))
const sampleFile = (index) => `judge-sample-${index}.pptx`
const judgedFiles = async () => {
  try {
    for (const [index, sample] of planted.entries()) {
      fs.writeFileSync(path.join(proofFolder, sampleFile(index)), storedZip(sample.parts))
    }
    const planting = (Date.now() - proofStarted) / 1000
    const found = await validatorLists([
      ...[...parts.keys()].map(fixturePath),
      ...planted.map((sample, index) => path.join(proofFolder, sampleFile(index))),
    ])
    return { found, planting }
  } finally {
    fs.rmSync(proofFolder, { recursive: true, force: true })
  }
}
const [{ found: lists, planting }] = await Promise.all([
  judgedFiles(),
  ...Array.from({ length: Math.min(os.availableParallelism(), 4) }, renderNext),
])
const ids = new Map([...parts].map(([name, packageParts]) => [name, pptx.shapeIdCounts(packageParts)]))
const judgedSamples = planted.map((sample, index) => {
  const judged = judge(
    pptx,
    { list: lists.get(sample.deck), ids: ids.get(sample.deck) },
    { list: lists.get(sampleFile(index)), ids: pptx.shapeIdCounts(sample.parts) },
  )
  const reason = judged.errors[0] ?? JSON.stringify(judged.dupes[0])
  return { ...sample, accepted: judged.accepted, reason }
})
console.log(`judge proof ${replay(seed)}`)
if (process.env.JUDGE_LIST !== undefined) {
  for (const sample of judgedSamples) {
    console.log(
      `judge sample  ${sample.kind}  ${sample.deck}, ${sample.what}  ${sample.accepted ? "accepted" : "rejected"}`,
    )
  }
}
for (const line of proofTable(judgedSamples)) console.log(line)
console.log(`judge proof planted ${planted.length} samples in ${planting.toFixed(1)} seconds`)
const proofLines = proofFailures({
  recorded: JSON.parse(fs.readFileSync(proofFile, "utf8")),
  judged: judgedSamples,
  seed,
})
for (const line of proofLines) console.log(line)
let failed = proofLines.length
for (const row of cases) {
  const { errors, dupes } = judge(
    pptx,
    { list: lists.get(row.before), ids: ids.get(row.before) },
    { list: lists.get(row.after), ids: ids.get(row.after) },
  )
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
const checkSeconds = timeStick(root, "PowerPoint check seconds", checkStarted)
console.log(checkSeconds.line)
if (checkSeconds.over !== undefined) console.log(checkSeconds.over)
if (failed > 0) console.log(`${failed} pptx checks failed`)
if (failed > 0 || checkSeconds.fails) process.exit(1)
console.log(`${cases.length} pptx checks passed`)
