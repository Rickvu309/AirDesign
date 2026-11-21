import { execFileSync } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  compareRuns,
  faultsOf,
  newFaults,
  passed,
  summarize,
  tasksHash,
  untouched,
  wantsOf,
} from "./agent-bench-score.mjs"
import { designContext, openBrowser } from "./browser.mjs"
import { cleanUp, stackFor } from "./proof.mjs"
import { publish } from "./publish.mjs"

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const tasksFile = path.join(skill, "bench/agent-tasks.json")
const release = "bench"
const prefix = "agent-bench"
const quietMs = 1000
const valued = ["--tasks", "--trials", "--model", "--effort", "--model-key-env", "--run", "--out"]

const fromRepo = (repo, file) => import(pathToFileURL(path.join(repo, file)).href)
const firstLine = (error) => String(error?.message ?? error).split("\n")[0]
const say = (line) => process.stderr.write(`${line}\n`)

function read(args) {
  const flags = { words: [] }
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index]
    if (word === "--keep") flags.keep = true
    else if (valued.includes(word) && args[index + 1] !== undefined && !args[index + 1].startsWith("--"))
      flags[word.slice(2)] = args[(index += 1)]
    else if (word.startsWith("--")) throw new Error(`unknown flag or missing value: ${word}`)
    else flags.words.push(word)
  }
  return flags
}

export function chosenTasks(tasks, given) {
  if (given === undefined) return tasks
  const patterns = given
    .split(",")
    .map((glob) => new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`))
  const chosen = tasks.filter((task) => patterns.some((pattern) => pattern.test(task.id)))
  if (chosen.length === 0) throw new Error(`no task matches ${given}`)
  return chosen
}

export function deckPath(repo, name) {
  for (const folder of ["scripts/pptx-fixtures", "scripts/pptx-fixtures/corpus"]) {
    const file = path.join(repo, folder, name)
    if (existsSync(file)) return file
  }
  throw new Error(`no deck ${name} in scripts/pptx-fixtures or its corpus`)
}

async function resolvedSlides(repo, pptx, parts) {
  const { resolvedSlide } = await fromRepo(repo, "tests/browser/resolved-paint.mts")
  if (pptx.prepareMarkup !== undefined) {
    const wasm = createRequire(path.join(repo, "packages/pptx/package.json")).resolve("sax-wasm/lib/sax-wasm.wasm")
    await pptx.prepareMarkup(new Uint8Array(readFileSync(wasm)))
  }
  const reader = pptx.paintReader(parts)
  return pptx.readSlides(parts).map(({ part }) => resolvedSlide(part, reader.slide(part)))
}

function watch(page, kit) {
  const seen = { turns: 0, calls: 0, open: 0, refusals: {} }
  const kind = (request) => {
    const at = new URL(request.url()).pathname
    if (at === kit.airaRoutes.turn.path) return "turn"
    if (at === kit.mcpRoutes.mcp.path && (request.postData() ?? "").includes('"tools/call"')) return "call"
    return null
  }
  page.on("request", (request) => {
    const found = kind(request)
    if (found === null) return
    seen.open += 1
    if (found === "turn") seen.turns += 1
    else seen.calls += 1
  })
  page.on("requestfailed", (request) => {
    if (kind(request) !== null) seen.open -= 1
  })
  page.on("requestfinished", async (request) => {
    const found = kind(request)
    if (found === null) return
    if (found === "call") {
      const text = await request
        .response()
        .then((response) => response?.text() ?? "")
        .catch(() => "")
      const refusal = /"refusal":"([a-z-]+)"/.exec(text)?.[1]
      if (refusal !== undefined) seen.refusals[refusal] = (seen.refusals[refusal] ?? 0) + 1
    }
    seen.open -= 1
  })
  return seen
}

async function runEnd(page, seen, limitMs) {
  const stop = page.getByRole("button", { name: "Stop", exact: true })
  const started = Date.now()
  let quietSince = null
  while (Date.now() - started < limitMs) {
    const quiet = seen.turns > 0 && seen.open === 0 && (await stop.count()) === 0
    if (!quiet) quietSince = null
    else if (quietSince === null) quietSince = Date.now()
    else if (Date.now() - quietSince >= quietMs) return { stopped: false, ms: quietSince - started }
    await page.waitForTimeout(100)
  }
  if ((await stop.count()) > 0) await stop.click()
  return { stopped: true, ms: Date.now() - started }
}

async function exported(page, file) {
  const download = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export", exact: true }).click()
  await page.getByRole("dialog", { name: "Export" }).getByRole("button", { name: "Export" }).click()
  await (await download).saveAs(file)
}

function tokensSince(file, from) {
  const tokens = { input: 0, read: 0, write: 0, output: 0 }
  if (file === undefined || !existsSync(file)) return tokens
  for (const line of readFileSync(file, "utf8").slice(from).split("\n").filter(Boolean)) {
    const counts = JSON.parse(line)
    for (const field of Object.keys(tokens)) tokens[field] += counts[field] ?? 0
  }
  return tokens
}

async function score({ repo, page, task, original, file, validate }) {
  const pptx = await fromRepo(repo, "packages/pptx/dist/index.js")
  const { slideFindings } = await fromRepo(repo, "packages/document/dist/index.js")
  const { fontFamily } = await fromRepo(repo, "packages/fonts/dist/index.js")
  const { slideWidths } = await fromRepo(repo, "tests/browser/measure-fonts.ts")
  const parts = {
    before: await pptx.readParts(new Uint8Array(readFileSync(original))),
    after: await pptx.readParts(new Uint8Array(readFileSync(file))),
  }
  const before = { slides: await resolvedSlides(repo, pptx, parts.before) }
  const after = { slides: await resolvedSlides(repo, pptx, parts.after) }
  const widths = await slideWidths(page, [...before.slides, ...after.slides], fontFamily)
  const judge = (slide) => slideFindings(slide, widths)
  const decoder = new TextDecoder()
  const side = (deck, name) => ({
    slides: deck.slides,
    faults: faultsOf(deck.slides, judge),
    xml: deck.slides.map((slide) => decoder.decode(parts[name].get(slide.slide) ?? new Uint8Array())),
  })
  const deck = { before: side(before, "before"), after: side(after, "after") }
  return {
    wants: wantsOf(task, deck),
    findings: {
      before: deck.before.faults.length,
      after: deck.after.faults.length,
      new: newFaults(deck.before.faults, deck.after.faults),
    },
    untouched: untouched(
      pptx.deckDiff(parts.before, parts.after),
      task.may,
      before.slides.map((slide) => slide.slide),
    ),
    validator: validate === null ? { ok: null, skipped: "no validator" } : await validate(pptx, original, file),
  }
}

async function indexed(kit, deck, cookie, limitMs) {
  const started = Date.now()
  for (;;) {
    const index = (await kit.post(kit.deckRoutes.open, { deck }, cookie)).json.register?.index
    if (index !== undefined && index.elements.length === index.total) return
    if (Date.now() - started >= limitMs) throw new Error(`deck ${deck} was not indexed in ${String(limitMs)} ms`)
    await kit.page.waitForTimeout(100)
  }
}

export async function trial(kit, task, { out, validate, number = 1, opened }) {
  const { page, repo } = kit
  const original = deckPath(repo, task.deck)
  const { cookie } = await kit.signIn()
  await page.goto("/")
  await page.locator("input[type=file]").setInputFiles(original)
  await page.waitForURL(/\/deck\/[A-Za-z0-9_-]{1,64}$/)
  await page.locator(".thin-page[data-deck-ready]").waitFor()
  const deck = page.url().split("/").at(-1)
  await indexed(kit, deck, cookie, task.limit.seconds * 1000)
  await opened?.({ deck, cookie })
  const seen = watch(page, kit)
  const countsFrom = kit.airaCounts !== undefined && existsSync(kit.airaCounts) ? statSync(kit.airaCounts).size : 0
  await page.getByRole("textbox", { name: "Ask Aira" }).fill(task.prompt)
  await page.keyboard.press("Enter")
  const end = await runEnd(page, seen, task.limit.seconds * 1000)
  const file = path.join(out, `${task.id}-${String(number)}.pptx`)
  await exported(page, file)
  const scored = await score({ repo, page, task, original, file, validate })
  const result = {
    task: task.id,
    trial: number,
    ...scored,
    calls: seen.calls,
    refusals: seen.refusals,
    tokens: tokensSince(kit.airaCounts, countsFrom),
    seconds: Math.round(end.ms / 100) / 10,
    stopped: end.stopped,
  }
  return { ...result, passed: passed(result, task), file }
}

export async function validator(repo) {
  const { findDotnet } = await fromRepo(repo, "scripts/dotnet-sdk.mjs")
  const sdk = findDotnet(process.env)
  if (sdk.problem !== undefined) throw new Error(`agent-bench run needs the validator. ${sdk.problem}`)
  const dotnet = sdk.command
  const { judgeBuild, judgeProgram, judgeRows, validatorCode, validatorLists } = await fromRepo(
    repo,
    "scripts/pptx-validator.mjs",
  )
  const { judgeParts, validatorBlindFaults } = await fromRepo(repo, "scripts/judge.mjs")
  execFileSync(dotnet, judgeBuild, { cwd: repo, stdio: "pipe" })
  return async (pptx, original, file) => {
    const lists = await validatorLists({
      files: [original, file],
      code: validatorCode(repo),
      validate: async (group) =>
        judgeRows(execFileSync(dotnet, [judgeProgram, ...group], { cwd: repo, encoding: "utf8", maxBuffer: 1 << 26 })),
    })
    const before = await pptx.readParts(new Uint8Array(readFileSync(original)))
    const after = await pptx.readParts(new Uint8Array(readFileSync(file)))
    const judged = judgeParts(
      pptx,
      {
        list: lists.get(path.basename(original)),
        ids: pptx.shapeIdCounts(before),
        orders: validatorBlindFaults(pptx, before),
        references: pptx.danglingShapeReferences(before),
        shared: pptx.sharedOwnedParts(before),
      },
      lists.get(path.basename(file)),
      after,
    )
    const found = [...judged.errors, ...[...judged.dupes, ...judged.dangling].map((row) => JSON.stringify(row))]
    return { ok: judged.accepted, new: found }
  }
}

function failedTrial(task, number, error) {
  return {
    task: task.id,
    trial: number,
    error: firstLine(error),
    wants: [],
    findings: { before: 0, after: 0, new: [] },
    untouched: { ok: false, changed: [], outside: [] },
    validator: { ok: null },
    calls: 0,
    refusals: {},
    tokens: { input: 0, read: 0, write: 0, output: 0 },
    seconds: task.limit.seconds,
    stopped: false,
    passed: false,
  }
}

function resultLine(meta, result) {
  const { file: _file, task, trial: number, passed: ok, ...rest } = result
  return {
    task,
    trial: number,
    model: meta.model,
    effort: meta.effort,
    commit: meta.commit,
    tasks: meta.tasks,
    passed: ok,
    ...rest,
  }
}

export function summaryTable(summary) {
  const rows = Object.entries(summary.perTask)
  const pass = rows.reduce((sum, [, row]) => sum + row.pass, 0) / Math.max(rows.length, 1)
  return [
    `agent-bench ${summary.model}/${summary.effort} at ${summary.commit.slice(0, 8)}, ${String(rows.length)} tasks x ${String(summary.trials)} trials: pass ${String(Math.round(pass * 100))} %`,
    "| task | family | pass | calls | tokens | seconds |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      ([id, row]) =>
        `| ${id} | ${row.family} | ${String(Math.round(row.pass * 100))} % | ${String(row.calls)} | ${String(row.tokens)} | ${String(row.seconds)} |`,
    ),
  ].join("\n")
}

async function runCommand(flags, runtime) {
  const text = readFileSync(tasksFile, "utf8")
  const tasks = chosenTasks(JSON.parse(text), flags.tasks)
  const trials = Number(flags.trials ?? 3)
  if (!Number.isInteger(trials) || trials < 1) throw new Error("--trials takes a whole number, 1 or more")
  if (flags.run === undefined && flags["model-key-env"] === undefined)
    throw new Error("agent-bench run calls the real model: pass --model-key-env NAME, the variable that holds the key")
  const args = ["model-key-env", "model", "effort"].flatMap((name) =>
    flags[name] === undefined ? [] : [`--${name}`, flags[name]],
  )
  const validate = await validator(runtime.repo)
  const cleanup = { runs: [], trees: [] }
  const run = stackFor({ run: flags.run, runtime, cleanup, args })
  let browser
  try {
    const state = runtime.readState(run)
    if (state.aira?.streams !== "real")
      throw new Error(`stack ${run} plays recorded streams; launch it with --model-key-env NAME`)
    const out = path.resolve(
      flags.out ?? runtime.evidenceDir(`agent-bench-${new Date().toISOString().replace(/[:.]/g, "-")}`),
    )
    mkdirSync(out, { recursive: true })
    const meta = { model: state.aira.model, effort: state.aira.effort, commit: state.commit, tasks: tasksHash(text) }
    const resultsFile = path.join(out, "results.jsonl")
    browser = await openBrowser()
    for (const task of tasks)
      for (let number = 1; number <= trials; number += 1) {
        const context = await browser.newContext({ baseURL: state.origin, ...designContext, acceptDownloads: true })
        try {
          const page = await context.newPage()
          const { kit } = await runtime.journeyKit({
            run,
            name: `agent-bench-${task.id}-${String(number)}`,
            page,
            context,
          })
          const result = await trial(kit, task, { out, validate, number }).catch((error) =>
            failedTrial(task, number, error),
          )
          if (result.passed && result.file !== undefined) rmSync(result.file, { force: true })
          appendFileSync(resultsFile, `${JSON.stringify(resultLine(meta, result))}\n`)
          say(
            `${task.id} trial ${String(number)}: ${result.passed ? "passed" : "failed"}, ${String(result.calls)} calls, ${String(result.seconds)} s${result.error === undefined ? "" : `, ${result.error}`}`,
          )
        } finally {
          await context.close()
        }
      }
    const results = readFileSync(resultsFile, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const summary = summarize({ results, tasks, run: { ...meta, trials } })
    writeFileSync(path.join(out, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
    const table = summaryTable(summary)
    writeFileSync(path.join(out, "summary.md"), `${table}\n`)
    say(table)
    return { command: "agent-bench run", out, summary: path.join(out, "summary.json") }
  } finally {
    await browser?.close()
    cleanUp(cleanup, flags.keep, runtime)
  }
}

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 })
}

function published(name) {
  return JSON.parse(gh(["release", "download", release, "--pattern", name, "--output", "-"]))
}

function loadSummary(given) {
  const file = existsSync(given) && statSync(given).isDirectory() ? path.join(given, "summary.json") : given
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : published(given)
}

function newestPublished(first) {
  const assets = JSON.parse(gh(["release", "view", release, "--json", "assets"])).assets ?? []
  const named = assets
    .filter((asset) => asset.name.startsWith(`${prefix}-`) && asset.name.endsWith(".json"))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
  for (const asset of named) {
    const summary = published(asset.name)
    if (summary.tasks === first.tasks && JSON.stringify(summary) !== JSON.stringify(first)) return summary
  }
  throw new Error(`no published run on the ${release} release has these tasks (${first.tasks})`)
}

function compareCommand(flags) {
  const [a, b] = flags.words
  if (a === undefined)
    throw new Error("agent-bench compare <run-dir or summary> [<run-dir, summary or published name>]")
  const first = loadSummary(a)
  const second = b === undefined ? newestPublished(first) : loadSummary(b)
  const compared = compareRuns(first, second)
  say(compared.lines.join("\n"))
  if (!compared.ok) process.exitCode = 1
  return { command: "agent-bench compare", ...compared }
}

function publishCommand(flags) {
  const [given] = flags.words
  if (given === undefined) throw new Error("agent-bench publish <run-dir>")
  const summary = loadSummary(given)
  const staged = mkdtempSync(path.join(os.tmpdir(), "agent-bench-"))
  try {
    const date = new Date().toISOString().slice(0, 10)
    const file = path.join(staged, `${summary.commit.slice(0, 8)}-${summary.model}-${summary.effort}-${date}.json`)
    writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`)
    const placed = publish({
      files: [file],
      prefix,
      release,
      kinds: [".json"],
      about: { title: "bench results", notes: "Results measured by hand. Not a product release." },
    })
    return { command: "agent-bench publish", ...placed }
  } finally {
    rmSync(staged, { recursive: true, force: true })
  }
}

export async function agentBenchCommand(args, runtime) {
  const [command, ...rest] = args
  const flags = read(rest)
  if (command === "run") return runCommand(flags, runtime)
  if (command === "compare") return compareCommand(flags)
  if (command === "publish") return publishCommand(flags)
  throw new Error("agent-bench run | compare | publish")
}
