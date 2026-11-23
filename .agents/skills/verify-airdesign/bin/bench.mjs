import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { doomCases } from "../bench/doom.mjs"
import { benchTable, schedule, sides, summary, verdict } from "./bench-verdict.mjs"
import { designContext, openBrowser } from "./browser.mjs"
import { load } from "./load.mjs"
import { cleanUp, mergeBase, stackFor } from "./proof.mjs"

export const throttle = 4
const caseLimit = 180_000
const ledger = path.join(os.homedir(), ".cache", "airdesign", "bench.jsonl")
const valued = ["--cases", "--runs", "--base", "--before-run", "--after-run", "--out"]
const defaultCases = doomCases.map((each) => each.name)

function read(args) {
  const flags = {}
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index]
    if (word === "--keep") flags.keep = true
    else if (valued.includes(word) && args[index + 1] !== undefined && !args[index + 1].startsWith("--"))
      flags[word.slice(2)] = args[(index += 1)]
    else throw new Error(`unknown flag or missing value: ${word}`)
  }
  return flags
}

export function casesFor(given, repo) {
  const known = [...doomCases]
  if (given === "all") return known
  return (given?.split(",") ?? defaultCases).map((name) => {
    const found = known.find((each) => each.name === name)
    if (found === undefined)
      throw new Error(`no bench case ${name}; one of ${known.map((each) => each.name).join(", ")}`)
    return found
  })
}

async function measureOnce({ browser, bench, run, origin, runtime }) {
  const context = await browser.newContext({ baseURL: origin, ...designContext })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(caseLimit)
    const { kit } = await runtime.journeyKit({ run, name: `bench-${bench.name}`, page, context })
    const prepared = await bench.setup(kit)
    const device = await context.newCDPSession(page)
    await device.send("Emulation.setCPUThrottlingRate", { rate: throttle })
    return await bench.measure(kit, prepared)
  } finally {
    await context.close()
  }
}

function loadOf(loads, cores) {
  return {
    max: Math.max(...loads.map((pair) => Math.max(...pair))),
    cores,
    above: loads.filter((pair) => Math.max(...pair) > cores).length,
  }
}

export async function benchCommand(args, runtime) {
  const flags = read(args)
  const runs = Number(flags.runs ?? 7)
  if (!Number.isInteger(runs) || runs < 2) throw new Error("--runs takes a whole number, 2 or more")
  const cases = casesFor(flags.cases, runtime.repo)
  const say = (line) => process.stderr.write(`${line}\n`)
  const { takeMachineLock } = await import(pathToFileURL(path.join(runtime.repo, "scripts/machine-lock.mjs")).href)
  const release = await takeMachineLock({ job: "bench", lane: "full", say })
  const cleanup = { runs: [], trees: [] }
  let browser
  try {
    const stacks = {
      main: stackFor({ run: flags["before-run"], ref: flags.base ?? mergeBase(runtime), runtime, cleanup }),
      branch: stackFor({ run: flags["after-run"], runtime, cleanup }),
    }
    const states = Object.fromEntries(sides.map((side) => [side, runtime.readState(stacks[side])]))
    browser = await openBrowser()
    const taken = Object.fromEntries(cases.map((bench) => [bench.name, { main: [], branch: [], loads: [] }]))
    for (const slot of schedule(
      cases.map((bench) => bench.name),
      runs,
    )) {
      const bench = cases.find((each) => each.name === slot.case)
      const before = load()
      let ms
      try {
        ms = await measureOnce({ browser, bench, run: stacks[slot.side], origin: states[slot.side].origin, runtime })
      } catch (error) {
        throw new Error(
          `${slot.case} on ${slot.side}, run ${String(slot.run)}: ${String(error?.message ?? error).split("\n")[0]}`,
        )
      }
      const after = load()
      const kept = taken[slot.case]
      kept[slot.side].push(Math.round(ms * 10) / 10)
      kept.loads.push([before.oneMinute, after.oneMinute])
      say(
        `${slot.case} ${slot.side} run ${String(slot.run)}: ${String(Math.round(ms))} ms, load ${String(after.oneMinute)}`,
      )
    }
    const cores = load().cores
    const rows = cases.map((bench) => {
      const kept = taken[bench.name]
      const main = summary(kept.main)
      const branch = summary(kept.branch)
      const judged = verdict(main, branch)
      return {
        case: bench.name,
        main,
        branch,
        ...judged,
        slower: judged.verdict === "slower",
        load: loadOf(kept.loads, cores),
      }
    })
    const report = {
      base: states.main.commit,
      head: states.branch.commit,
      throttle,
      runs,
      cases: rows,
      load: loadOf(
        Object.values(taken).flatMap((kept) => kept.loads),
        cores,
      ),
    }
    const out = path.resolve(
      flags.out ?? runtime.evidenceDir(`bench-${new Date().toISOString().replace(/[:.]/g, "-")}`),
    )
    mkdirSync(out, { recursive: true })
    const table = benchTable({ ...report, rows })
    writeFileSync(path.join(out, "bench.json"), `${JSON.stringify(report, null, 2)}\n`)
    writeFileSync(path.join(out, "bench.md"), `\`\`\`\n${table}\n${path.join(out, "bench.md")}\n\`\`\`\n`)
    mkdirSync(path.dirname(ledger), { recursive: true })
    const at = new Date().toISOString()
    for (const row of rows)
      appendFileSync(
        ledger,
        `${JSON.stringify({ at, base: report.base, head: report.head, case: row.case, main: row.main.median, branch: row.branch.median, verdict: row.verdict, load: row.load })}\n`,
      )
    say(`${table}\n${path.join(out, "bench.md")}`)
    const slower = rows.filter((row) => row.slower).map((row) => row.case)
    if (slower.length > 0) process.exitCode = 1
    return { command: "bench", slower, report: path.join(out, "bench.md") }
  } finally {
    await browser?.close()
    cleanUp(cleanup, flags.keep, runtime)
    await release({ status: process.exitCode === 1 ? "failed" : "passed" })
  }
}
