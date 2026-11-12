import { execFile, execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { randomInt } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  boxExportLines,
  boxExportName,
  browserExportArgs,
  freshExports,
  judgedExportNames,
  paragraphExportLines,
  paragraphsExportName,
  validatorFiles,
} from "./paragraph-export.mjs"
import { judgeParts } from "./judge.mjs"
import {
  changedSinceArgs,
  freshMissFails,
  plantSamples,
  proofFailures,
  proofTable,
  readSeedList,
  seedsFor,
  settleRun,
} from "./judge-proof.mjs"
import { scoreWrittenRoute, writtenRouteFiles } from "./pptx-route-judge.mjs"
import { takeMachineLock } from "./machine-lock.mjs"
import { judgedWrites, timeMetric } from "./metrics.mjs"
import {
  afterRender,
  checkFails,
  committedArgs,
  corpusDecision,
  corpusInputs,
  corpusResult,
  validatorList,
} from "./pptx-corpus.mjs"
import {
  committedBlobs,
  renderCache,
  renderCacheFolder,
  renderCode,
  renderName,
  renderPages,
  renderSettings,
  renderUse,
  readMachine,
} from "./pptx-render.mjs"
import { slideEditsExportName, slideEditsLines } from "./slide-edits.mjs"
import { diagramEditsExportName, diagramEditsLines } from "./diagram-edits.mjs"
import { slideExportLines, slideExportName } from "./slide-export.mjs"
import { storedZip } from "./stored-zip.mjs"
import { blankCase, blankExportLines, blankExportName } from "./blank-export.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
await takeMachineLock()
const checkStarted = Date.now()
const dotnet = process.env.PPTX_DOTNET ?? "dotnet"
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const fixtures = path.join(root, "scripts/pptx-fixtures")
const browserExportName = "exported-deck.pptx"
const browserExportPath = path.join(root, "tests/browser", browserExportName)
const paragraphsExportPath = path.join(root, "tests/browser", paragraphsExportName)
const boxExportPath = path.join(root, "tests/browser", boxExportName)
const slideExportPath = path.join(root, "tests/browser", slideExportName)
const browserShape = "2"
const browserText = "Hello!"
const inputs = corpusInputs(root)

const run = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(command, args, { cwd: root, env: process.env, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const failure = new Error([stdout, stderr].filter(Boolean).join("\n").trim() || `${command} failed`)
        failure.stdout = stdout
        failure.stderr = stderr
        reject(failure)
      } else {
        resolve(stdout)
      }
    })
  })

const validatorLists = async (files) => {
  const lists = new Map()
  const output = await run(dotnet, ["run", "--project", "scripts/pptx-judge", "-v", "q", "--", ...files])
  for (const line of output.split("\n")) {
    if (!line.startsWith("{")) continue
    const row = JSON.parse(line)
    lists.set(row.file, validatorList(row))
  }
  return lists
}

const renderCacheReady = readMachine({ soffice, pdftoppm: "pdftoppm", env: process.env }).then((machine) =>
  renderCache({
    folder: renderCacheFolder,
    machine,
    settings: renderSettings,
    code: renderCode(),
    render: (file) => renderPages(file, { soffice, pdftoppm: "pdftoppm", run }),
  }),
)

await run("pnpm", ["--filter", "@airdesign/pptx", "build"])
const browserSpec = freshExports({
  deck: browserExportPath,
  paragraphs: paragraphsExportPath,
  box: boxExportPath,
  slides: slideExportPath,
  also: [
    path.join(root, "tests/browser", blankExportName),
    path.join(root, "tests/browser/exported-blank-slides.pptx"),
    path.join(root, "tests/browser", slideEditsExportName),
    path.join(root, "tests/browser", diagramEditsExportName),
  ],
  run: () => run("pnpm", ["exec", "playwright", "test", ...browserExportArgs]),
})
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
const browserExports = new Map([
  [browserExportName, browserExportPath],
  [paragraphsExportName, paragraphsExportPath],
  [boxExportName, boxExportPath],
  [slideExportName, slideExportPath],
  [blankExportName, path.join(root, "tests/browser", blankExportName)],
  ["exported-blank-slides.pptx", path.join(root, "tests/browser/exported-blank-slides.pptx")],
  [slideEditsExportName, path.join(root, "tests/browser", slideEditsExportName)],
  [diagramEditsExportName, path.join(root, "tests/browser", diagramEditsExportName)],
])
const fixturePath = (name) => browserExports.get(name) ?? path.join(root, decision.deckPath(name))
const rendered = new Map()
const renderNext = async () => {
  for (let render = waiting.shift(); render !== undefined; render = waiting.shift()) {
    const renders = await renderCacheReady
    const file = fixturePath(renderName(render))
    const bytes = fs.readFileSync(file)
    try {
      rendered.set(render, await renders.pages({ file, bytes, use: renderUse({ render, bytes, committed }) }))
    } catch (error) {
      const failure = decision.renderFailure(render, error)
      console.log(failure.line)
      rendered.set(render, failure.pages)
    }
  }
}
const proofStarted = Date.now()
const proofFile = path.join(fixtures, "judge-proof.json")
const proofSeeds = seedsFor({
  chosen: process.env.JUDGE_SEED,
  list: readSeedList(fs.readFileSync(path.join(fixtures, "judge-seeds.json"), "utf8")),
  draw: () => randomInt(0, 4294967296),
  commit: await run("git", ["rev-parse", "HEAD"]),
})
const decision = corpusDecision({
  argv: process.argv,
  seeds: proofSeeds,
  ...inputs,
  cases,
  browser: browserExportName,
})
const waiting = [...decision.renders]
console.log(`${decision.announce}: ${decision.added.join(", ")}`)
const gitAnswer = (args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return undefined
  }
}
const committed = committedBlobs(gitAnswer(committedArgs("HEAD")) ?? "")
committed.delete(browserExportName)
const eventFile = process.env.GITHUB_EVENT_PATH
const freshFails = freshMissFails({
  eventText: eventFile === undefined ? undefined : fs.existsSync(eventFile) ? fs.readFileSync(eventFile, "utf8") : "",
  mergeBase: () => gitAnswer(["merge-base", "HEAD", "origin/main"]),
  changedSince: (base) => gitAnswer(changedSinceArgs(base))?.split("\n"),
})
const cleanDecks = ["clean.pptx", "nasa-1d-cnn.pptx", "doe-heat-pumps.pptx", "census-updating-spm.pptx"]
const parts = new Map()
for (const name of new Set([...names, ...cleanDecks])) {
  if (name === browserExportName) continue
  parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
}
const routeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-route-"))
const writtenDecks = []
for (const name of decision.routeDecks) {
  if (!parts.has(name)) parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
  const deckParts = parts.get(name)
  const written = await writtenRouteFiles(
    pptx,
    fs.readFileSync(fixturePath(name)),
    deckParts,
    routeDir,
    name.slice(0, -".pptx".length),
  )
  writtenDecks.push({ name, deckParts, written })
}
const routeFiles = writtenDecks.flatMap((deck) =>
  deck.written.flatMap((item) => (item.file === null ? [] : [item.file])),
)
const decks = cleanDecks.map((name) => ({ name, parts: parts.get(name) }))
const samples = Number(process.env.JUDGE_SAMPLES ?? 3)
const runs = proofSeeds.map((run) => ({ ...run, planted: plantSamples({ pptx, decks, seed: run.seed, samples }) }))
const proofFolder = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-judge-proof-"))
const sampleFile = (seed, index) => `judge-sample-${seed}-${index}.pptx`
const judgedFiles = async () => {
  try {
    for (const run of runs) {
      for (const [index, sample] of run.planted.entries()) {
        fs.writeFileSync(path.join(proofFolder, sampleFile(run.seed, index)), storedZip(sample.parts))
      }
    }
    const planting = (Date.now() - proofStarted) / 1000
    const found = await validatorLists(
      validatorFiles({
        names: parts.keys(),
        fixturePath,
        others: [
          ...routeFiles,
          ...runs.flatMap((run) => run.planted.map((_, index) => path.join(proofFolder, sampleFile(run.seed, index)))),
        ],
      }),
    )
    return { found, planting }
  } finally {
    fs.rmSync(proofFolder, { recursive: true, force: true })
  }
}
const spec = await browserSpec
console.log(`browser export spec ${spec.seconds.toFixed(1)} seconds`)
if (spec.ok) {
  parts.set(browserExportName, await pptx.readParts(fs.readFileSync(browserExportPath)))
  for (const name of judgedExportNames(spec)) {
    parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
  }
  parts.set(blankExportName, await pptx.readParts(fs.readFileSync(fixturePath(blankExportName))))
  parts.set(
    "exported-blank-slides.pptx",
    await pptx.readParts(fs.readFileSync(fixturePath("exported-blank-slides.pptx"))),
  )
  parts.set(slideEditsExportName, await pptx.readParts(fs.readFileSync(fixturePath(slideEditsExportName))))
  parts.set(diagramEditsExportName, await pptx.readParts(fs.readFileSync(fixturePath(diagramEditsExportName))))
  cases.push(blankCase)
  waiting.push(blankExportName)
  waiting.push(browserExportName)
} else {
  const index = cases.findIndex((row) => row.name === "browser-text-export")
  if (index >= 0) cases.splice(index, 1)
}
const [{ found: lists, planting }] = await Promise.all([
  judgedFiles(),
  ...Array.from({ length: Math.min(os.availableParallelism(), 4) }, renderNext),
])
console.log((await renderCacheReady).line())
const ids = new Map([...parts].map(([name, packageParts]) => [name, pptx.shapeIdCounts(packageParts)]))
const orders = new Map([...parts].map(([name, packageParts]) => [name, pptx.branchOrderErrors(packageParts)]))
const references = new Map([...parts].map(([name, packageParts]) => [name, pptx.danglingShapeReferences(packageParts)]))
const judgedBefore = (name) => ({
  list: lists.get(name),
  ids: ids.get(name),
  orders: orders.get(name),
  references: references.get(name),
})
const recorded = JSON.parse(fs.readFileSync(proofFile, "utf8"))
let failed = 0
for (const run of runs) {
  const judgedSamples = run.planted.map((sample, index) => {
    const judged = judgeParts(pptx, judgedBefore(sample.deck), lists.get(sampleFile(run.seed, index)), sample.parts)
    const reason = judged.errors[0] ?? JSON.stringify(judged.dupes[0] ?? judged.dangling[0])
    return { ...sample, accepted: judged.accepted, reason }
  })
  console.log(`judge proof ${run.announce}`)
  if (process.env.JUDGE_LIST !== undefined) {
    for (const sample of judgedSamples) {
      console.log(
        `judge sample  ${sample.kind}  ${sample.deck}, ${sample.what}  ${sample.accepted ? "accepted" : "rejected"}`,
      )
    }
  }
  for (const line of proofTable(judgedSamples)) console.log(line)
  const proofLines = proofFailures({
    recorded,
    judged: judgedSamples,
    seed: run.seed,
    known: run.known,
    chosen: run.chosen,
  })
  const settled = settleRun({ run, lines: proofLines, freshFails })
  for (const line of settled.lines) console.log(line)
  failed += settled.failed
}
const plantedCount = runs.reduce((sum, run) => sum + run.planted.length, 0)
console.log(`judge proof planted ${plantedCount} samples in ${planting.toFixed(1)} seconds`)
if (!spec.ok) {
  failed += 1
  console.error(spec.line)
  if (spec.detail !== "") console.error(spec.detail)
} else {
  const cleanParts = parts.get("clean.pptx")
  const exportParts = parts.get(browserExportName)
  if (cleanParts === undefined || exportParts === undefined) throw new Error("browser export")
  for (const failure of pptx.browserExportFailures(cleanParts, exportParts, browserShape, browserText)) {
    failed += 1
    console.log(failure)
  }
  for (const line of paragraphExportLines({ pptx, parts, lists, ids, orders })) {
    failed += 1
    console.log(line)
  }
  for (const line of boxExportLines({ pptx, parts, lists, ids, orders })) {
    failed += 1
    console.log(line)
  }
  for (const line of [
    ...slideExportLines({ pptx, parts, lists, ids, orders }),
    ...blankExportLines({ pptx, parts, lists }),
    ...slideExportLines({
      pptx,
      parts,
      lists,
      ids,
      orders,
      kept: [...parts.get("blank.pptx").keys()].filter(
        (name) => !["[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"].includes(name),
      ),
      original: "blank.pptx",
      exported: "exported-blank-slides.pptx",
    }),
    ...slideEditsLines({ pptx, parts, lists, ids, orders }),
    ...diagramEditsLines({ pptx, parts, lists, ids, orders }),
  ]) {
    failed += 1
    console.log(line)
  }
}
for (const row of cases) {
  const { errors, dupes, dangling } = judgeParts(
    pptx,
    judgedBefore(row.before),
    lists.get(row.after),
    parts.get(row.after),
  )
  const pages = pptx.exactPageCheck({
    before: rendered.get(row.before),
    after: rendered.get(afterRender(row)),
    targeted: row.targeted,
    visible: row.visible,
  })
  if (errors.length !== row.errors || dupes.length !== row.dupes || dangling.length !== 0 || pages !== row.pages) {
    failed += 1
    console.log(
      JSON.stringify({ name: row.name, errors: errors.length, dupes: dupes.length, dangling: dangling.length, pages }),
    )
  }
}
const checkSeconds = decision.duration(() => timeMetric(root, "pptx-check-duration", checkStarted))
console.log(checkSeconds.line)
if (checkSeconds.over !== undefined) console.log(checkSeconds.over)
const routeFailures = []
const seen = new Map()
for (const deck of decision.hardOf(writtenDecks)) {
  const beforeErrors = lists.get(deck.name) ?? []
  for (const item of deck.written) {
    const operation = item.run.operation
    const row = seen.get(operation) ?? { ok: true }
    seen.set(operation, row)
    const afterErrors = item.file === null ? undefined : lists.get(path.basename(item.file))
    const failure = scoreWrittenRoute(pptx, deck.deckParts, beforeErrors, item, afterErrors)
    if (failure !== null) {
      row.ok = false
      routeFailures.push({ deck: deck.name, ...failure })
    }
  }
}
const passedOperations = [...seen].filter(([, row]) => row.ok).map(([operation]) => operation)
for (const operation of pptx.routeOperations) {
  if (!seen.has(operation)) routeFailures.push({ operation, missing: true })
}
const recordedWrites = JSON.parse(fs.readFileSync(path.join(root, "metrics.json"), "utf8"))[judgedWrites]?.now
if (recordedWrites !== passedOperations.length) {
  routeFailures.push({
    metric: judgedWrites,
    measured: passedOperations.length,
    recorded: recordedWrites,
  })
}
const corpus = corpusResult({ decision, pptx, decks: writtenDecks, lists, rendered, freshFails })
for (const line of corpus.lines) console.log(line)
console.log(`${corpus.judged} corpus decks judged, ${corpus.misses} misses, ${corpus.failed} fail this run`)
fs.rmSync(routeDir, { recursive: true, force: true })
for (const failure of routeFailures) console.log(JSON.stringify(failure))
if (failed > 0) console.log(`${failed} pptx checks failed`)
else console.log(`${cases.length} pptx checks passed`)
if (routeFailures.length > 0) console.log(`${routeFailures.length} route writes failed`)
else console.log(`${pptx.routeOperations.length} route writes passed`)
if (checkFails({ failed, routeFailures, duration: checkSeconds, corpus })) process.exit(1)
