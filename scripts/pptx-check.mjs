import { execFile, execFileSync } from "node:child_process"
import { randomInt } from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { validatorFiles } from "./paragraph-export.mjs"
import { freshBrowserExport, playwrightTestLines } from "./browser-export.mjs"
import { browserExportArgs, caseExports, caseOriginals, loadCases } from "./pptx-cases.mjs"
import { textExportName } from "./pptx-cases/text.mjs"
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
import { localImage } from "./local-image.mjs"
import { memoPptx } from "./pptx-memo.mjs"
import { besideBrowser, phaseClock } from "./pptx-phases.mjs"
import { pruneKeyed } from "./keyed-cache.mjs"
import {
  judgeBuild,
  judgeProgram,
  judgeRows,
  validatorCode,
  validationFolder,
  validatorLine,
  validatorLists as validatedLists,
} from "./pptx-validator.mjs"
import { judgedWrites, timeMetric } from "./metrics.mjs"
import {
  afterRender,
  checkFails,
  committedArgs,
  corpusDecision,
  corpusInputs,
  corpusPartition,
  corpusResult,
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
import { cloneEditsLines, writeCloneEdits } from "./clone-edits.mjs"
import { corpusEditLines, writeCorpusEdits } from "./corpus-edits.mjs"
import { storedZip } from "./stored-zip.mjs"
import { sectionProofDeck, sectionProofLines, sectionWarnLines, writeSectionProof } from "./section-list.mjs"
import { browserEnv } from "../.agents/skills/verify-airdesign/bin/browser.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
await takeMachineLock({ job: "pptx" })
const checkStarted = Date.now()
const phases = phaseClock()
const dotnet = process.env.PPTX_DOTNET ?? "dotnet"
const soffice = process.env.PPTX_SOFFICE ?? "soffice"
const fixtures = path.join(root, "scripts/pptx-fixtures")
const inputs = corpusInputs(root)
const { fixedWork } = corpusPartition({ argv: process.argv, ...inputs })
const entries = fixedWork ? await loadCases(root) : []
const exportNames = caseExports(entries)
const exportPath = (name) => path.join(root, "tests/browser", name)

const run = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd: root, env: browserEnv(process.env), maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const failure = new Error([stdout, stderr].filter(Boolean).join("\n").trim() || `${command} failed`)
          failure.stdout = stdout
          failure.stderr = stderr
          reject(failure)
        } else {
          resolve(stdout)
        }
      },
    )
  })

const background = (command, args) => run("nice", ["-n", "19", command, ...args])

const judgeBuilt = background(dotnet, judgeBuild)
judgeBuilt.catch(() => {})
const validatorTally = { files: 0, distinct: 0, hits: 0 }
const validatorLists = async (files) => {
  await judgeBuilt
  await quiet
  return validatedLists({
    files,
    code: validatorCode(root),
    tally: validatorTally,
    validate: async (group) => judgeRows(await background(dotnet, [judgeProgram, ...group])),
  })
}

const renderCacheReady = readMachine({ soffice, pdftoppm: "pdftoppm", env: process.env }).then((machine) =>
  renderCache({
    folder: renderCacheFolder,
    machine: machine.imageOs === null && machine.imageVersion === null ? { ...machine, ...localImage() } : machine,
    settings: renderSettings,
    code: renderCode(),
    render: (file) => renderPages(file, { soffice, pdftoppm: "pdftoppm", run: background }),
  }),
)

await phases.time("build", () => run("pnpm", ["--filter", "@airdesign/pptx", "build"]))
let specOutput = ""
const browserSpec = fixedWork
  ? freshBrowserExport({
      file: exportPath(exportNames[0]),
      also: exportNames.slice(1).map(exportPath),
      run: () =>
        phases.time("browser", async () => {
          specOutput = await run("pnpm", [
            "exec",
            "playwright",
            "test",
            "--reporter=list",
            ...browserExportArgs(entries),
          ])
        }),
    })
  : Promise.resolve({ ok: true, seconds: 0 })
const quiet = besideBrowser({ cores: os.availableParallelism(), browser: browserSpec })
const pptx = memoPptx(await import(pathToFileURL(path.join(root, "packages/pptx/dist/index.js")).href))
const cases = fixedWork ? JSON.parse(fs.readFileSync(path.join(fixtures, "cases.json"), "utf8")) : []
const names = [...new Set([...cases.flatMap((row) => [row.before, row.after]), ...caseOriginals(entries)])]
const browserExports = new Map(exportNames.map((name) => [name, exportPath(name)]))
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
const renderWidth = Math.min(os.availableParallelism(), 4)
const startRenders = () => {
  const done = phases.time("render", async () => {
    await quiet
    await Promise.all(Array.from({ length: renderWidth }, renderNext))
  })
  done.catch(() => {})
  return done
}
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
  browser: textExportName,
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
for (const name of exportNames) committed.delete(name)
const earlyRenders = startRenders()
const eventFile = process.env.GITHUB_EVENT_PATH
const freshFails = freshMissFails({
  eventText: eventFile === undefined ? undefined : fs.existsSync(eventFile) ? fs.readFileSync(eventFile, "utf8") : "",
  mergeBase: () => gitAnswer(["merge-base", "HEAD", "origin/main"]),
  changedSince: (base) => gitAnswer(changedSinceArgs(base))?.split("\n"),
})
const cleanDecks = fixedWork
  ? ["clean.pptx", "nasa-1d-cnn.pptx", "doe-heat-pumps.pptx", "census-updating-spm.pptx"]
  : []
const validations = []
const validate = (files) => {
  const done = phases.time("validate", () => validatorLists(files))
  done.catch(() => {})
  validations.push(done)
}
const fixtureNames = [...new Set([...names, ...cleanDecks])].filter((name) => !exportNames.includes(name))
validate(validatorFiles({ names: fixtureNames, fixturePath, others: [] }))
const endPrep = phases.begin("prep")
const parts = new Map()
for (const name of new Set([...names, ...cleanDecks])) {
  if (exportNames.includes(name)) continue
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
  validate(
    validatorFiles({
      names: fixtureNames.includes(name) ? [] : [name],
      fixturePath,
      others: written.flatMap((item) => (item.file === null ? [] : [item.file])),
    }),
  )
}
if (fixedWork) {
  const cloneEditsFile = await writeCloneEdits({ pptx, root, parts, directory: routeDir })
  validate([cloneEditsFile])
}
const sectionProof = fixedWork ? writeSectionProof({ parts: parts.get(sectionProofDeck), directory: routeDir }) : []
validate(sectionProof.map((row) => row.file))
const corpusEdits = await writeCorpusEdits({
  full: decision.full,
  root,
  decks: decision.routeDecks.map(fixturePath),
  directory: routeDir,
})
validate(corpusEdits.rows.map((row) => row.file))
const decks = cleanDecks.map((name) => ({ name, parts: parts.get(name) }))
const samples = Number(process.env.JUDGE_SAMPLES ?? 3)
const plantStarted = Date.now()
const runs = (fixedWork ? proofSeeds : []).map((run) => ({
  ...run,
  planted: plantSamples({ pptx, decks, seed: run.seed, samples }),
}))
const proofFolder = fs.mkdtempSync(path.join(os.tmpdir(), "pptx-judge-proof-"))
const sampleFile = (seed, index) => `judge-sample-${seed}-${index}.pptx`
for (const run of runs) {
  for (const [index, sample] of run.planted.entries()) {
    fs.writeFileSync(path.join(proofFolder, sampleFile(run.seed, index)), storedZip(sample.parts))
  }
}
const planting = (Date.now() - plantStarted) / 1000
validate(runs.flatMap((run) => run.planted.map((_, index) => path.join(proofFolder, sampleFile(run.seed, index)))))
endPrep()
const spec = await browserSpec
console.log(`browser export spec ${spec.seconds.toFixed(1)} seconds`)
for (const line of playwrightTestLines(specOutput)) console.log(line)
if (spec.ok) {
  for (const name of exportNames) parts.set(name, await pptx.readParts(fs.readFileSync(fixturePath(name))))
  for (const entry of entries) {
    cases.push(...(entry.cases ?? []))
    waiting.push(...(entry.renders ?? []))
  }
  validate(validatorFiles({ names: exportNames, fixturePath, others: [] }))
}
const answered = await Promise.all([...validations, earlyRenders, startRenders()]).finally(() =>
  fs.rmSync(proofFolder, { recursive: true, force: true }),
)
const lists = new Map(answered.slice(0, validations.length).flatMap((found) => [...found]))
console.log((await renderCacheReady).line())
console.log(validatorLine(validatorTally))
const endJudging = phases.begin("judging")
const ids = new Map([...parts].map(([name, packageParts]) => [name, pptx.shapeIdCounts(packageParts)]))
const orders = new Map([...parts].map(([name, packageParts]) => [name, pptx.branchOrderErrors(packageParts)]))
const references = new Map([...parts].map(([name, packageParts]) => [name, pptx.danglingShapeReferences(packageParts)]))
const shared = new Map([...parts].map(([name, packageParts]) => [name, pptx.sharedOwnedParts(packageParts)]))
const judgedBefore = (name) => ({
  list: lists.get(name),
  ids: ids.get(name),
  orders: orders.get(name),
  references: references.get(name),
  shared: shared.get(name),
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
  for (const entry of entries) {
    for (const line of entry.lines({ pptx, parts, lists, ids, orders })) {
      failed += 1
      console.log(line)
    }
  }
}
for (const line of fixedWork ? cloneEditsLines({ pptx, parts, lists, ids, orders }) : []) {
  failed += 1
  console.log(line)
}
for (const line of [
  ...(corpusEdits.failure === null ? [] : [corpusEdits.failure]),
  ...corpusEditLines({ pptx, rows: corpusEdits.rows, lists }),
]) {
  failed += 1
  console.log(line)
}
if (decision.full) console.log(`corpus edits ${corpusEdits.rows.length} exports judged`)
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
for (const line of sectionProofLines({ pptx, proof: sectionProof, lists })) console.log(line)
const routeBacks = writtenDecks.flatMap((deck) =>
  deck.written.flatMap((item) => (item.back === null ? [] : [[path.basename(item.file), item.back]])),
)
for (const line of sectionWarnLines({ pptx, files: [...parts, ...routeBacks] })) console.log(line)
endJudging()
const checkSeconds = decision.duration(() => timeMetric(root, "pptx-check-duration", checkStarted))
console.log(checkSeconds.line)
if (checkSeconds.over !== undefined) console.log(checkSeconds.over)
const endRoutes = phases.begin("routes")
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
for (const operation of fixedWork ? pptx.routeOperations : []) {
  if (!seen.has(operation)) routeFailures.push({ operation, missing: true })
}
const recordedWrites = JSON.parse(fs.readFileSync(path.join(root, "metrics.json"), "utf8"))[judgedWrites]?.now
if (fixedWork && recordedWrites !== passedOperations.length) {
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
endRoutes()
for (const line of phases.lines()) console.log(line)
pruneKeyed(validationFolder, { olderThanDays: 30 })
for (const failure of routeFailures) console.log(JSON.stringify(failure))
if (failed > 0) console.log(`${failed} pptx checks failed`)
else console.log(`${cases.length} pptx checks passed`)
if (routeFailures.length > 0) console.log(`${routeFailures.length} route writes failed`)
else console.log(`${passedOperations.length} route writes passed`)
if (checkFails({ failed, routeFailures, duration: checkSeconds, corpus })) process.exit(1)
