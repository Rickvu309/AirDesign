import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { failedScripts, failedTests } from "./failed-tests.mjs"
import { replayVariable } from "./property-seed.mjs"
import { cleanEnvironment } from "./test-environment.mjs"

const harness = ["scripts/property-count.mjs", "scripts/property-seed.mjs"]
const toolingTest = /^(?:scripts\/[^/]+\.test\.mjs|tooling\/.+\.js)$/
const browserSpec = /^tests\/browser\//
const journeySpec = /^tests\/journeys\//
const wholeFile = "(the whole file)"
const unitSeconds = 120
const browserSeconds = 300
const tokens = new Set(["GH_TOKEN", "GITHUB_TOKEN", "RED_MAIN_TOKEN"])

const namePattern = (name) =>
  name
    .split(" > ")
    .join(" ")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const rerunCommand = (test) => {
  const env = test.replay === undefined ? {} : { [replayVariable]: JSON.stringify(test.replay) }
  if (toolingTest.test(test.file) && test.name === wholeFile)
    return { browser: false, command: "node", args: ["scripts/tooling-tests.mjs", test.file], env }
  if (browserSpec.test(test.file) || journeySpec.test(test.file))
    return {
      browser: true,
      command: "pnpm",
      args: [
        journeySpec.test(test.file) ? "test:journeys" : "test:browser",
        test.file,
        "--grep",
        namePattern(test.name),
        "--workers=1",
      ],
      env,
    }
  const only = test.name === wholeFile ? [] : ["-t", namePattern(test.name)]
  return { browser: false, command: "node", args: ["node_modules/vitest/vitest.mjs", "run", test.file, ...only], env }
}

const shape = (error) => (error ?? "").replace(/\d+/g, "#").trim()

export const rerunResult = ({ test, status, output }) => {
  const found = [...failedTests(output), ...failedScripts(output)].find(
    (each) => each.file === test.file && each.name === test.name,
  )
  if (found === undefined)
    return status === 0
      ? { result: "passes" }
      : { result: "unclear", why: `it ended with status ${status} and named no failure of this test` }
  return shape(found.error) === shape(test.error)
    ? { result: "fails", error: found.error }
    : { result: "unclear", why: `it fails there with "${found.error}", not "${test.error}"` }
}

const seconds = (since, now) => Math.round((now() - since) / 100) / 10

export const greenRerun = ({ root, run, now = Date.now, say = () => {}, home = os.tmpdir() }) => {
  const trees = new Map()
  const results = new Map()
  const prepare = (at, browser) => {
    const known = trees.get(at)
    if (known?.why !== undefined || (known !== undefined && (!browser || known.browser))) return known
    const started = now()
    const dir = known?.dir ?? path.join(home, `green-rerun-${at}`)
    const steps = [
      ...(known === undefined
        ? [
            ["git", ["worktree", "remove", "--force", dir], root, true],
            ["git", ["worktree", "add", "--detach", "--force", dir, at], root],
            ["pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], dir],
          ]
        : []),
      ...(browser ? [["pnpm", ["exec", "playwright", "install", "--only-shell", "chromium"], dir]] : []),
    ]
    for (const [command, args, cwd, mayFail] of steps) {
      const done = run(command, args, { cwd, seconds: unitSeconds })
      if (done.status !== 0 && !mayFail) {
        const failed = {
          why: `${command} ${args.slice(0, 2).join(" ")} failed at ${at}: ${done.output.trim().split("\n").at(-1)}`,
        }
        trees.set(at, failed)
        return failed
      }
      if (args[0] === "worktree" && args[1] === "add")
        for (const file of harness) fs.copyFileSync(path.join(root, file), path.join(dir, file))
    }
    const ready = { dir, browser: browser || known?.browser === true }
    trees.set(at, ready)
    say(
      `green rerun: ${browser ? "browser tools" : "worktree and install"} at ${at.slice(0, 9)} took ${seconds(started, now)} s`,
    )
    return ready
  }
  return ({ at, test }) => {
    const key = JSON.stringify([at, test.file, test.name, test.replay])
    if (results.has(key)) return results.get(key)
    const command = rerunCommand(test)
    const tree = prepare(at, command.browser)
    if (tree.why !== undefined) return { result: "unrun", at, why: tree.why }
    const started = now()
    const done = run(command.command, command.args, {
      cwd: tree.dir,
      env: command.env,
      seconds: command.browser ? browserSeconds : unitSeconds,
    })
    const outcome = { ...rerunResult({ test, status: done.status, output: done.output }), at, command }
    say(`green rerun: ${test.file} › ${test.name} ${outcome.result} at ${at.slice(0, 9)} in ${seconds(started, now)} s`)
    results.set(key, outcome)
    return outcome
  }
}

const rerunEnvironment = (env, extra) => ({
  ...Object.fromEntries(Object.entries(cleanEnvironment(env)).filter(([name]) => !tokens.has(name))),
  NO_COLOR: "1",
  FORCE_COLOR: "0",
  ...extra,
})

export const rerunProcess = (command, args, { cwd, env = {}, seconds: limit }) => {
  const done = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: rerunEnvironment(process.env, env),
    timeout: limit * 1000,
    maxBuffer: 256 * 2 ** 20,
  })
  const timedOut = done.error?.code === "ETIMEDOUT" ? `\nstopped after ${limit} s\n` : ""
  return { status: done.status ?? 1, output: `${done.stdout ?? ""}${done.stderr ?? ""}${timedOut}` }
}
