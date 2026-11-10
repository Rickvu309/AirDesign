import { execFile, execFileSync } from "node:child_process"
import { createHash, randomInt } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { freshBrowserExport } from "./browser-export.mjs"
import { judge } from "./judge.mjs"
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
import { loadedPptx, scoreWrittenRoute, writtenRouteFilesInThread } from "./pptx-route-judge.mjs"
import { takeMachineLock } from "./machine-lock.mjs"
import { judgedWrites, timeMetric } from "./metrics.mjs"
import { runSteps } from "./run-steps.mjs"
import { storedZip } from "./stored-zip.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
await takeMachineLock()
const checkStarted = Date.now()
const dotnet = process.env.PPTX_DOTNET ?? "dotnet"
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const fixtures = path.join(root, "scripts/pptx-fixtures")
const browserExportName = "exported-deck.pptx"
const browserExportPath = path.join(root, "tests/browser", browserExportName)
const browserShape = "2"
const browserText = "Hello!"

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
const browserSpec = freshBrowserExport({
  file: browserExportPath,
  run: () => run("pnpm", ["exec", "playwright", "test", "tests/browser/thin-deck.spec.ts"]),
})
const pptx = await loadedPptx(root)
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
const renderName = (render) => (render.endsWith(" again") ? render.slice(0, -" again".length) : render)
const waiting = [...new Set(cases.flatMap((row) => [row.before, afterRender(row)]))].filter(
  (render) => renderName(render) !== browserExportName,
)
const rendered = new Map()
const renderNext = async () => {
  for (let render = waiting.shift(); render !== undefined; render = waiting.shift()) {
    const name = render.endsWith(" again") ? render.slice(0, -" again".length) : render
    rendered.set(render, await renderPages(fixturePath(name)))
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
const gitAnswer = (args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return undefined
  }
}
const eventFile = process.env.GITHUB_EVENT_PATH
const freshFails = freshMissFails({
  eventText: eventFile === undefined ? undefined : fs.existsSync(eventFile) ? fs.readFileSync(eventFile, "utf8") : "",
  mergeBase: () => gitAnswer(["merge-base", "HEAD", "origin/main"]),
  changedSince: (base) => gitAnswer(changedSinceArgs(base))?.split("\n"),
})
const cleanDecks = ["clean.pptx", "nasa-1d-cnn.pptx", "doe-heat-pumps.pptx", "census-updating-spm.pptx"]
const parts = new Map()
const realDecks = fs
  .readdirSync(fixtures)
  .filter((name) => name.endsWith(".pptx") && fs.statSync(fixturePath(name)).size >= 100_000)
  .sort()
const routeDir = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-route-"))
const samples = Number(process.env.JUDGE_SAMPLES ?? 3)
const sampleFile = (seed, index) => `judge-sample-${seed}-${index}.pptx`
const judgedFiles = async (routeFiles, runs) => {
  const proofFolder = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-judge-proof-"))
  try {
    for (const run of runs) {
      for (const [index, sample] of run.planted.entries()) {
        fs.writeFileSync(path.join(proofFolder, sampleFile(run.seed, index)), storedZip(sample.parts))
      }
    }
    const planting = (Date.now() - proofStarted) / 1000
    const found = await validatorLists([
      ...[...parts.keys()].map(fixturePath),
      ...routeFiles,
      ...runs.flatMap((run) => run.planted.map((_, index) => path.join(proofFolder, sampleFile(run.seed, index)))),
    ])
    return { found, planting }
  } finally {
    fs.rmSync(proofFolder, { recursive: true, force: true })
  }
}
const done = await runSteps({
  renders: {
    run: () => Promise.all(Array.from({ length: Math.min(os.availableParallelism(), 4) }, renderNext)),
  },
  routes: {
    run: () =>
      Promise.all(
        realDecks.map((name) =>
          writtenRouteFilesInThread({
            root,
            file: fixturePath(name),
            directory: routeDir,
            prefix: name.slice(0, -".pptx".length),
          }),
        ),
      ),
  },
  spec: {
    run: async () => {
      const spec = await browserSpec
      console.log(`browser export spec ${spec.seconds.toFixed(1)} seconds`)
      if (spec.ok) {
        parts.set(browserExportName, await pptx.readParts(fs.readFileSync(browserExportPath)))
      } else {
        const index = cases.findIndex((row) => row.name === "browser-text-export")
        if (index >= 0) cases.splice(index, 1)
      }
      return spec
    },
  },
  browserRender: {
    after: ["spec"],
    run: async ({ spec }) => {
      if (spec.ok) rendered.set(browserExportName, await renderPages(fixturePath(browserExportName)))
    },
  },
  runs: {
    run: async () => {
      for (const name of new Set([...names, ...cleanDecks])) {
        if (name === browserExportName) continue
        parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
      }
      for (const name of realDecks) {
        if (!parts.has(name)) parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
      }
      const decks = cleanDecks.map((name) => ({ name, parts: parts.get(name) }))
      return proofSeeds.map((run) => ({ ...run, planted: plantSamples({ pptx, decks, seed: run.seed, samples }) }))
    },
  },
  validator: {
    after: ["routes", "spec", "runs"],
    run: ({ routes, runs }) =>
      judgedFiles(
        routes.flatMap((written) => written.flatMap((item) => (item.file === null ? [] : [item.file]))),
        runs,
      ),
  },
})
const { spec, runs } = done
const { found: lists, planting } = done.validator
const writtenDecks = realDecks.map((name, index) => ({ name, deckParts: parts.get(name), written: done.routes[index] }))
const ids = new Map([...parts].map(([name, packageParts]) => [name, pptx.shapeIdCounts(packageParts)]))
const orders = new Map([...parts].map(([name, packageParts]) => [name, pptx.branchOrderErrors(packageParts)]))
const recorded = JSON.parse(fs.readFileSync(proofFile, "utf8"))
let failed = 0
for (const run of runs) {
  const judgedSamples = run.planted.map((sample, index) => {
    const judged = judge(
      pptx,
      { list: lists.get(sample.deck), ids: ids.get(sample.deck), orders: orders.get(sample.deck) },
      {
        list: lists.get(sampleFile(run.seed, index)),
        ids: pptx.shapeIdCounts(sample.parts),
        orders: pptx.branchOrderErrors(sample.parts),
      },
    )
    const reason = judged.errors[0] ?? JSON.stringify(judged.dupes[0])
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
}
for (const row of cases) {
  const { errors, dupes } = judge(
    pptx,
    { list: lists.get(row.before), ids: ids.get(row.before), orders: orders.get(row.before) },
    { list: lists.get(row.after), ids: ids.get(row.after), orders: orders.get(row.after) },
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
const checkSeconds = timeMetric(root, "pptx-check-duration", checkStarted)
console.log(checkSeconds.line)
if (checkSeconds.over !== undefined) console.log(checkSeconds.over)
const routeFailures = []
const seen = new Map()
for (const deck of writtenDecks) {
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
fs.rmSync(routeDir, { recursive: true, force: true })
for (const failure of routeFailures) console.log(JSON.stringify(failure))
if (failed > 0) console.log(`${failed} pptx checks failed`)
else console.log(`${cases.length} pptx checks passed`)
if (routeFailures.length > 0) console.log(`${routeFailures.length} route writes failed`)
else console.log(`${pptx.routeOperations.length} route writes passed`)
if (failed > 0 || routeFailures.length > 0 || checkSeconds.fails) process.exit(1)
