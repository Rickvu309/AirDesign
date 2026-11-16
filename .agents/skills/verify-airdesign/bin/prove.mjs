import { execFileSync, spawn, spawnSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { browserEnv } from "./browser.mjs"
import { load } from "./load.mjs"
import { proofPlan } from "./prove-plan.mjs"
import { changedFiles, failedTests, rerunCommand, suiteRules } from "./suites.mjs"

const cli = fileURLToPath(new URL("./verify-airdesign.mjs", import.meta.url))
const vitest = "node_modules/vitest/vitest.mjs"
const smallUnitLimit = 40
const kinds = ["unit", "tooling", "specs", "browser", "look", "pptx", "bench"]
const optIn = { pptx: "run it with --pptx, it takes 1 to 2 minutes", bench: "bench suggested: pnpm prove --bench" }

const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim()
const fromRepo = (repo, file) => import(pathToFileURL(path.join(repo, file)).href)

const importGraph = (repo, folder, pattern) => {
  const graph = {}
  for (const name of readdirSync(path.join(repo, folder)).filter((each) => pattern.test(each))) {
    const text = readFileSync(path.join(repo, folder, name), "utf8")
    const specifiers = [...text.matchAll(/(?:from|import\()\s*"(\.[^"]+)"/g)].map((match) => match[1])
    graph[`${folder}/${name}`] = specifiers.map((specifier) => {
      const joined = path.posix.join(folder, specifier)
      return path.extname(joined) === "" && existsSync(path.join(repo, `${joined}.ts`)) ? `${joined}.ts` : joined
    })
  }
  return graph
}

const screenAreas = (repo) => {
  const web = path.join(repo, "apps/web/src")
  const screens = {}
  for (const area of readdirSync(web, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    for (const file of readdirSync(path.join(web, area.name), { recursive: true })) {
      if (!/\.(ts|tsx)$/.test(file) || /\.test\./.test(file)) continue
      const text = readFileSync(path.join(web, area.name, file), "utf8")
      for (const [, screen] of text.matchAll(/"(\/screens\/s[0-9a-z-]+)"/g)) screens[screen] ??= area.name
    }
  }
  return screens
}

const movedSpecs = (repo, base) => {
  if (!existsSync(path.join(repo, "scripts/spec-sync.mjs"))) return []
  return execFileSync(process.execPath, ["scripts/spec-sync.mjs", "--since", base], { cwd: repo, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
}

export const readFacts = async (repo, against) => {
  const base = git(repo, ["merge-base", against, "HEAD"])
  const { states } = await import("../look/states.mjs")
  const { replays } = await fromRepo(repo, "scripts/spec-replays.mjs")
  return {
    base,
    head: git(repo, ["rev-parse", "HEAD"]),
    changed: changedFiles(repo, against),
    moved: movedSpecs(repo, base),
    screens: screenAreas(repo),
    states: states.map(({ name, design }) => ({ name, design: design ?? null })),
    replays: replays(repo),
    scripts: importGraph(repo, "scripts", /\.mjs$/),
    browser: importGraph(repo, "tests/browser", /\.(ts|mts)$/),
    rules: suiteRules(repo),
  }
}

const exec = (repo, [command, args], env, log) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { cwd: repo, env: { ...process.env, ...env } })
    let output = ""
    const take = (chunk) => {
      output += chunk
      appendFileSync(log, chunk)
    }
    child.stdout.on("data", take)
    child.stderr.on("data", take)
    child.on("error", (error) => {
      take(`${error.message}\n`)
      resolve({ status: 1, output })
    })
    child.on("close", (status) => resolve({ status: status ?? 1, output }))
  })

const lastJson = (output) => JSON.parse(output.split("\n").findLast((line) => line.startsWith("{")) ?? "{}")

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : undefined)

export const proveCommand = async (args, { repo, evidenceRoot }) => {
  const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const plan = proofPlan(await readFacts(repo, flag("--base") ?? "origin/main"))
  if (args.includes("--plan")) return plan
  const only = flag("--only")?.split(",") ?? kinds
  const out = path.join(evidenceRoot, `prove-${new Date().toISOString().replace(/[:.]/g, "-")}`)
  mkdirSync(out, { recursive: true })
  const { takeMachineLock, smallLaneCommand } = await fromRepo(repo, "scripts/machine-lock.mjs")
  const { stages } = await fromRepo(repo, "scripts/check.mjs")
  const specCache = { AIRDESIGN_SPEC_CACHE: stages.flat().find(([name]) => name === "test")[3].AIRDESIGN_SPEC_CACHE }
  const run = (lane, command, args) => (lane === "small" ? smallLaneCommand(command, args) : [command, args])
  const tests = (lane, files, json) =>
    run(lane, "node", [
      vitest,
      "run",
      ...(lane === "small" ? ["--maxWorkers=2"] : []),
      "--reporter=default",
      "--reporter=json",
      `--outputFile.json=${json}`,
      ...files,
    ])
  const vitestResult = (ran, json) => {
    const report = readJson(json)
    const failed = (report?.testResults ?? [])
      .filter((result) => result.status === "failed")
      .map((result) => path.relative(repo, result.name))
    return {
      passed: ran.status === 0,
      result: `${ran.status === 0 ? "PASSED" : "FAILED"} ${String(report?.numPassedTests ?? 0)} tests${failed.length > 0 ? `, failed ${String(report.numFailedTests)}` : ""}`,
      rerun: failed.length > 0 ? `node ${vitest} run ${failed.join(" ")}` : undefined,
    }
  }

  const steps = {
    unit: async (step, log) => {
      if (step.tests === "all") {
        const json = path.join(out, "unit.json")
        return {
          lane: "full",
          what: "every unit test",
          go: async () => vitestResult(await exec(repo, tests("full", [], json), specCache, log), json),
        }
      }
      const listed = path.join(out, "unit-list.json")
      await exec(repo, ["node", [vitest, "list", "--filesOnly", `--json=${listed}`, "--changed", plan.base]], {}, log)
      const files = (readJson(listed) ?? []).map((entry) => path.relative(repo, entry.file))
      const lane = files.length <= smallUnitLimit ? "small" : "full"
      const what = `vitest related: ${String(step.files.length)} changed sources -> ${String(files.length)} test files`
      if (files.length === 0)
        return { lane, what, go: async () => ({ passed: true, result: "no test file reaches them" }) }
      const json = path.join(out, "unit.json")
      return {
        lane,
        what,
        go: async () => vitestResult(await exec(repo, tests(lane, files, json), specCache, log), json),
      }
    },
    tooling: async (step, log) => ({
      lane: "small",
      what: step.files.join(", "),
      go: async () => {
        const failed = []
        for (const file of step.files)
          if ((await exec(repo, run("small", "node", [file]), {}, log)).status !== 0) failed.push(file)
        return {
          passed: failed.length === 0,
          result: failed.length === 0 ? `PASSED ${String(step.files.length)} files` : `FAILED ${failed.join(", ")}`,
          rerun: failed.length > 0 ? failed.map((file) => `node ${file}`).join("; ") : undefined,
        }
      },
    }),
    specs: async (step, log) => ({
      lane: "small",
      what: `${step.topics.join(", ")}: TLC, then ${step.replays.join(", ") || "no replay"}`,
      go: async () => {
        const tlc = await exec(repo, run("small", "node", ["scripts/check-specs.mjs", ...step.topics]), specCache, log)
        if (tlc.status !== 0)
          return { passed: false, result: "FAILED in TLC", rerun: `pnpm check:specs ${step.topics.join(" ")}` }
        if (step.replays.length === 0) return { passed: true, result: "PASSED TLC" }
        const json = path.join(out, "replays.json")
        return vitestResult(await exec(repo, tests("small", step.replays, json), specCache, log), json)
      },
    }),
    browser: async (step, log) => {
      const limited = spawnSync("systemd-run", ["--user", "--scope", "--quiet", "true"]).status === 0
      const playwright = [
        "test:browser",
        ...step.specs,
        `--repeat-each=${String(step.repeat)}`,
        `--workers=${String(step.workers)}`,
        "--reporter=line,json",
      ]
      const command = limited
        ? ["systemd-run", ["--user", "--scope", "--quiet", "-p", `CPUQuota=${step.cpu}`, "pnpm", ...playwright]]
        : ["pnpm", playwright]
      const report = path.join(out, "browser.json")
      return {
        lane: "full",
        what: `${step.specs.join(", ")} x${String(step.repeat)} on ${String(step.workers)} worker${step.workers === 1 ? "" : "s"}, ${limited ? `CPU ${step.cpu}` : "no CPU limit: systemd-run --user is missing"}`,
        go: async () => {
          const ran = await exec(
            repo,
            command,
            { ...browserEnv(process.env), PLAYWRIGHT_JSON_OUTPUT_FILE: report },
            log,
          )
          const stats = readJson(report)?.stats ?? {}
          const total = (stats.expected ?? 0) + (stats.unexpected ?? 0) + (stats.flaky ?? 0)
          return {
            passed: ran.status === 0,
            result:
              total === 0
                ? `FAILED before any test ran: ${log}`
                : `${ran.status === 0 ? "PASSED" : "FAILED"} ${String(stats.expected ?? 0)}/${String(total)}`,
            rerun: ran.status === 0 ? undefined : rerunCommand("browser", failedTests(readJson(report) ?? {})),
          }
        },
      }
    },
    look: async (step, log) => ({
      lane: "full",
      what: `${String(step.states.length)} states`,
      go: async () => {
        const launched = await exec(repo, ["node", [cli, "launch"]], {}, log)
        const stack = lastJson(launched.output).run
        if (launched.status !== 0 || stack === undefined)
          return { passed: false, result: `FAILED to launch, see ${log}` }
        try {
          const sheet = path.join(out, "sheet")
          const looked = await exec(
            repo,
            ["node", [cli, "sheet", stack, "--only", step.states.join(","), "--out", sheet]],
            {},
            `${log}.sheet`,
          )
          const answer = lastJson(looked.output)
          return {
            passed: looked.status === 0 && !answer.failed,
            result: `findings ${String(answer.count ?? "?")}, sheet ${answer.summary ?? sheet}`,
          }
        } finally {
          await exec(repo, ["node", [cli, "stop", stack]], {}, `${log}.stop`)
        }
      },
    }),
    bench: async (step, log) => ({
      lane: "full",
      what: "bench of this branch against its merge base, CPU throttle 4",
      go: async () => {
        const ran = await exec(repo, ["node", [cli, "bench", "--base", plan.base]], {}, log)
        const answer = lastJson(ran.output)
        const said = answer.slower?.length > 0 ? `SLOWER ${answer.slower.join(", ")}` : "FAILED"
        return {
          passed: ran.status === 0,
          result: `${ran.status === 0 ? "no case slower" : said}, ${answer.report ?? log}`,
          rerun: ran.status === 0 ? undefined : "pnpm prove --bench --only bench",
        }
      },
    }),
    pptx: async (step, log) => ({
      lane: "full",
      what: "pnpm check:pptx",
      go: async () => {
        const ran = await exec(repo, ["pnpm", ["check:pptx"]], {}, log)
        return {
          passed: ran.status === 0,
          result: ran.status === 0 ? "PASSED" : "FAILED",
          rerun: ran.status === 0 ? undefined : "pnpm check:pptx",
        }
      },
    }),
  }

  const say = (line) => process.stderr.write(`${line}\n`)
  say(
    `prove: ${String(plan.changed.length)} changed files against ${flag("--base") ?? "origin/main"} (merge base ${plan.base.slice(0, 8)})`,
  )
  const rows = []
  const notRun = []
  let held
  const letGo = async () => {
    await held?.release({ status: held.failed ? "failed" : "passed" })
    held = undefined
  }
  try {
    for (const step of plan.steps) {
      if (step.kind === "note") {
        say(`note      ${step.text}`)
        notRun.push(step.text)
        continue
      }
      if (!only.includes(step.kind) || (step.kind in optIn && !args.includes(`--${step.kind}`))) {
        const why = only.includes(step.kind) ? optIn[step.kind] : "left out by --only"
        say(why === optIn.bench ? why : `${step.kind.padEnd(9)} not run: ${why}`)
        notRun.push(`${step.kind} (${why})`)
        continue
      }
      const log = path.join(out, `${step.kind}.log`)
      const { lane, what, go } = await steps[step.kind](step, log)
      const queued = Date.now()
      if (held?.lane !== lane) {
        await letGo()
        held = { lane, failed: false, release: await takeMachineLock({ job: `prove-${step.kind}`, lane, say }) }
      }
      const before = load()
      const started = Date.now()
      const done = await go()
      if (!done.passed) held.failed = true
      const after = load()
      const row = {
        kind: step.kind,
        what,
        lane,
        ...done,
        waited: Math.round((started - queued) / 1000),
        seconds: Math.round((Date.now() - started) / 1000),
        load: `${String(before.oneMinute)} -> ${String(after.oneMinute)} / ${String(after.cores)}`,
        log,
      }
      rows.push(row)
      const waited = row.waited > 1 ? `, waited ${String(row.waited)} s` : ""
      say(`${step.kind.padEnd(9)} ${what}   ${lane} lane${waited}   ${row.result} in ${String(row.seconds)} s`)
    }
  } finally {
    await letGo()
  }
  for (const kind of kinds.filter((each) => !plan.steps.some((step) => step.kind === each)))
    notRun.push(`${kind} (not touched)`)
  say(`note      ci also runs: ${plan.ciAlso.join(", ")}`)
  const branch = git(repo, ["rev-parse", "--abbrev-ref", "HEAD"])
  const reruns = rows.filter((row) => row.rerun).map((row) => `- ${row.kind}: \`${row.rerun}\``)
  const proof = [
    `# Proof for ${branch} at ${plan.head.slice(0, 8)} (base ${plan.base.slice(0, 8)})`,
    "",
    "| step | what ran | result | seconds | load start -> end / cores |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) => `| ${row.kind} | ${row.what}, ${row.lane} lane | ${row.result} | ${String(row.seconds)} | ${row.load} |`,
    ),
    "",
    `Not run: ${notRun.join("; ") || "nothing"}.`,
    `ci also runs: ${plan.ciAlso.join(", ")}.`,
    ...(reruns.length > 0 ? ["", "Rerun a failure alone:", ...reruns] : []),
    "",
  ].join("\n")
  const file = path.join(out, "proof.md")
  writeFileSync(file, proof)
  say(`proof: ${file}`)
  const passed = rows.every((row) => row.passed)
  if (!passed) process.exitCode = 1
  return { command: "prove", passed, proof: file }
}
