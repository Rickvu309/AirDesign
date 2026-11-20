import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { browserEnv } from "./browser.mjs"
import { load, loadLine } from "./load.mjs"

const skillPath = ".agents/skills/verify-airdesign/"

export function workspaceDirs(repo, app) {
  const manifest = JSON.parse(readFileSync(path.join(repo, app, "package.json"), "utf8"))
  return Object.entries({ ...manifest.dependencies, ...manifest.devDependencies })
    .filter(([, version]) => String(version).startsWith("workspace:"))
    .map(([name]) => `packages/${name.replace(/^@airdesign\//, "")}/`)
}

export function pptxPaths(list) {
  return list.split("\n").filter(Boolean)
}

export function suiteRules(repo) {
  const web = workspaceDirs(repo, "apps/web")
  const api = workspaceDirs(repo, "apps/api")
  const watched = readFileSync(path.join(repo, ".github/actions/ci-changes/pptx-paths.txt"), "utf8")
  return [
    { name: "check", script: ["check"], paths: [""] },
    {
      name: "browser-tests",
      script: ["test:browser"],
      paths: ["apps/web/", ...web, "tests/browser/", "playwright.config.ts", "pnpm-lock.yaml", `${skillPath}look/`],
    },
    {
      name: "journeys",
      script: ["test:journeys"],
      paths: [
        "apps/web/",
        "apps/api/",
        ...web,
        ...api,
        "tests/journeys/",
        skillPath,
        "playwright.journeys.config.mts",
        "pnpm-lock.yaml",
      ],
    },
    { name: "pptx", script: ["check:pptx"], paths: pptxPaths(watched) },
  ]
}

export function suitesFor(changed, rules) {
  return rules.flatMap((rule) => {
    const hit = changed.find((file) =>
      rule.paths.some(
        (given) => file === given || file.startsWith(given.endsWith("/") || given === "" ? given : `${given}/`),
      ),
    )
    return hit === undefined ? [] : [{ name: rule.name, script: rule.script, because: hit }]
  })
}

export function changedFiles(repo, base = "origin/main") {
  const git = (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).split("\n").filter(Boolean)
  const from = git(["merge-base", base, "HEAD"])[0]
  return [...new Set([...git(["diff", "--name-only", from]), ...git(["ls-files", "--others", "--exclude-standard"])])]
}

export function failedTests(report) {
  const found = []
  const walk = (suite) => {
    for (const spec of suite.specs ?? [])
      if (!spec.ok) found.push({ file: spec.file, line: spec.line, title: spec.title })
    for (const inner of suite.suites ?? []) walk(inner)
  }
  for (const suite of report.suites ?? []) walk(suite)
  return found
}

export function rerunCommand(suite, failed) {
  if (failed.length === 0) return undefined
  const picks =
    suite === "journeys"
      ? ["-g", failed.map((test) => test.title).join("|")]
      : failed.map((test) => `tests/browser/${path.basename(test.file)}:${String(test.line)}`)
  return `node ${skillPath}bin/verify-airdesign.mjs suites --run ${suite} -- ${picks.map((pick) => (pick.includes("|") ? `'${pick}'` : pick)).join(" ")}`
}

function runScript(repo, script, extra, env) {
  return new Promise((resolve) => {
    const child = spawn("pnpm", [...script, ...extra], { cwd: repo, stdio: "inherit", env })
    child.on("exit", (code) => resolve(code ?? 1))
  })
}

async function machineLock(repo) {
  const file = path.join(repo, "scripts/machine-lock.mjs")
  if (!existsSync(file)) return async () => {}
  const { takeMachineLock } = await import(pathToFileURL(file).href)
  return takeMachineLock({ job: "suites" })
}

export async function suitesCommand(args, { repo, evidenceRoot }) {
  const split = args.indexOf("--")
  const own = split === -1 ? args : args.slice(0, split)
  const extra = split === -1 ? [] : args.slice(split + 1)
  const rules = suiteRules(repo)
  const named = own.filter((word) => !word.startsWith("--"))
  const changed = changedFiles(repo)
  const chosen =
    named.length > 0
      ? rules.filter((rule) => named.includes(rule.name)).map((rule) => ({ ...rule, because: "named" }))
      : suitesFor(changed, rules)
  if (!own.includes("--run")) {
    return {
      command: "suites",
      changed: changed.length,
      suites: chosen.map(({ name, script, because }) => ({ name, run: `pnpm ${script.join(" ")}`, because })),
      skipped: rules.filter((rule) => !chosen.some((pick) => pick.name === rule.name)).map((rule) => rule.name),
      now: loadLine(),
    }
  }
  const out = path.join(evidenceRoot, `suites-${new Date().toISOString().replace(/[:.]/g, "-")}`)
  mkdirSync(out, { recursive: true })
  const release = await machineLock(repo)
  const results = []
  try {
    for (const suite of chosen) {
      const report = path.join(out, `${suite.name}.json`)
      const env = {
        ...browserEnv(process.env),
        JOURNEYS_REPORT: report,
        PLAYWRIGHT_JSON_OUTPUT_FILE: report,
      }
      const reporter = suite.name === "browser-tests" ? ["--reporter=line,json"] : []
      const before = load()
      const started = Date.now()
      process.stderr.write(
        `\n== ${suite.name}: pnpm ${suite.script.join(" ")} ${[...reporter, ...extra].join(" ")} (${loadLine(before)})\n`,
      )
      const code = await runScript(repo, suite.script, [...reporter, ...extra], env)
      const after = load()
      const failed = existsSync(report) ? failedTests(JSON.parse(readFileSync(report, "utf8"))) : []
      results.push({
        name: suite.name,
        passed: code === 0,
        seconds: Math.round((Date.now() - started) / 1000),
        load: { start: before.oneMinute, end: after.oneMinute, cores: after.cores },
        failed: failed.map((test) => `${path.basename(test.file)}:${String(test.line)} ${test.title}`),
        alone: code === 0 ? undefined : rerunCommand(suite.name, failed),
      })
    }
  } finally {
    await release()
  }
  const lines = results.map(
    (result) =>
      `- ${result.name}: ${result.passed ? "PASSED" : "FAILED"} in ${String(result.seconds)} s, measured under load ${String(result.load.start)} to ${String(result.load.end)} on ${String(result.load.cores)} cores${result.alone ? `. Rerun alone: \`${result.alone}\`` : ""}`,
  )
  writeFileSync(path.join(out, "suites.md"), `# Suites\n\n${lines.join("\n")}\n`)
  if (results.some((result) => !result.passed)) process.exitCode = 1
  return {
    command: "suites",
    passed: results.every((result) => result.passed),
    results,
    summary: path.join(out, "suites.md"),
  }
}
