import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { expect, it } from "vitest"
import { ciCoverageHits, verifierBuildHits, workerLibraryHits } from "../../scripts/lint/ci-workflow-policy.ts"
import { requiresFullGate } from "../../scripts/gate/plan.ts"

const scripts: Record<string, string> = JSON.parse(readFileSync("package.json", "utf8")).scripts
const testConfig = readFileSync("vitest.config.ts", "utf8")
const hits = (scripts: Record<string, string>, workflow: string) => ciCoverageHits(scripts, workflow, testConfig)
const workflow = readFileSync(".github/workflows/ci.yml", "utf8")

it("rejects the original absent CI and covers every PR verifier and workspace test", () => {
  expect(hits(scripts, "jobs: {}\n")).not.toEqual([])
  expect(hits(scripts, workflow)).toEqual([])
  expect(hits({ ...scripts, "gate:unit": "echo skipped" }, workflow)).toContain("ci-gate-script-drift: unit")
  expect(hits(scripts, workflow.replace("if: always()", "if: success()"))).toContain("ci-final-gate-must-always-run")
  expect(hits({ ...scripts, "verify:pr-10": "node scripts/future.mjs" }, workflow)).toContain("ci-verification-not-covered: verify:pr-10")
  expect(hits({ ...scripts, test: "vitest run packages/deck" }, workflow)).toContain("ci-workspace-tests-must-use-unfiltered-vitest-discovery")
  expect(hits(scripts, workflow.replace("shard: [1/2, 2/2]", "shard: [1/2]"))).toContain("ci-unit-shards-incomplete")
  expect(hits(scripts, workflow.replace("npm run gate:verify", "echo skipped"))).toContain("ci-verification-shards-not-executed")
  expect(hits(scripts, workflow.replace("[setup, static, unit, verification, design]", "[setup, static, unit, design]"))).toContain("ci-final-gate-missing-dependency: verification")
})

it("rejects verifiers that rebuild the shared artifact", () => {
  expect(hits({ ...scripts, "verify:mcp": "npm run build:mcp-renderer && vitest run" }, workflow)).toContain("ci-verifier-rebuilds: verify:mcp")
})

it("skips only informational CI documentation and never skips empty or executable changes", () => {
  expect(requiresFullGate(["docs/release/ci.md"])).toBe(false)
  for (const files of [[], ["docs/design/v0.1/tokens.md"], ["docs/release/ci.md", "package.json"], ["apps/studio/src/main.tsx"], [".github/workflows/ci.yml"]]) {
    expect(requiresFullGate(files)).toBe(true)
  }
})

it("keeps future workspace tests in default discovery", () => {
  expect(ciCoverageHits(scripts, workflow, testConfig.replace("packages/**/*.{test,spec}.{tsx,jsx}", "packages/ui/**/*.{test,spec}.{tsx,jsx}"))).toContain("ci-workspace-test-pattern-missing: packages:tsx,jsx")
})

it("rejects the original verifier builds and accepts shared build consumers", () => {
  expect(verifierBuildHits("/repo/scripts/verify-render.mjs", '["npx", ["vite", "build"]]')).toEqual(["ci-verifier-rebuilds-shared-artifact"])
  expect(verifierBuildHits("/repo/scripts/verify-deck.mjs", '["node", ["scripts/build-deck.mjs"]]')).toEqual(["ci-verifier-rebuilds-shared-artifact"])
  for (const name of ["render", "studio", "sync", "import-export", "deck", "ui"]) {
    const file = `/repo/scripts/verify-${name}.mjs`
    expect(verifierBuildHits(file, readFileSync(`scripts/verify-${name}.mjs`, "utf8"))).toEqual([])
  }
})

it("reports a passing gate only for complete work or the deliberate documentation skip", () => {
  const script = workflow.match(/node --input-type=module <<'JS'\n([\s\S]+?)\n          JS/)?.[1]
  expect(script).toBeTruthy()
  function check(heavy: boolean, overrides: Record<string, string> = {}) {
    const expected = heavy ? "success" : "skipped"
    const jobs = {
      setup: { result: "success", outputs: { heavy: String(heavy) } },
      static: { result: expected }, unit: { result: expected }, verification: { result: expected }, design: { result: "skipped" },
    }
    for (const name of ["setup", "static", "unit", "verification", "design"] as const) {
      const result = overrides[name]
      if (result) jobs[name].result = result
    }
    return spawnSync(process.execPath, ["--input-type=module"], { input: script, env: { ...process.env, RESULTS: JSON.stringify(jobs) } }).status
  }
  expect(check(true)).toBe(0)
  expect(check(false)).toBe(0)
  for (const name of ["setup", "static", "unit", "verification", "design"]) {
    expect(check(true, { [name]: "failure" })).toBe(1)
    expect(check(true, { [name]: "cancelled" })).toBe(1)
  }
  expect(check(true, { unit: "skipped" })).toBe(1)
  expect(check(false, { verification: "success" })).toBe(1)
})

it("requires the real worker isolation runtime in unit and selected verification jobs", () => {
  expect(hits(scripts, workflow.replaceAll("./.github/actions/prepare-worker", "./.github/actions/restore-gate"))).toContain("ci-unit-worker-isolation-unavailable")
  expect(hits(scripts, workflow.replace("if: matrix.isolation", "if: matrix.browser"))).toContain("ci-verification-worker-isolation-unavailable")
})

it("requires measured unit sharding", () => {
  expect(ciCoverageHits(scripts, workflow, testConfig.replace("sequencer: MeasuredSequencer", "sequencer: undefined"))).toContain("ci-unit-shards-must-use-measured-durations")
})

it("keeps the x64 dynamic loader mounted in both isolated worker entry points", () => {
  for (const file of ["apps/worker/src/isolation.ts", "apps/worker/src/export/deliver.ts"]) {
    const source = readFileSync(file, "utf8")
    expect(workerLibraryHits(file, source)).toEqual([])
    expect(workerLibraryHits(file, source.replace(/"--ro-bind-try",\s*"\/lib64",\s*"\/lib64",/, ""))).not.toEqual([])
  }
})

it("keeps project npm installer permissions out of inherited CLI flags", () => {
  const directory = mkdtempSync(join(process.env.TMPDIR ?? join(homedir(), "tmp"), "gate-npm-"))
  try {
    writeFileSync(join(directory, "npm"), '#!/bin/sh\n[ -z "$npm_config_allow_scripts" ] || exit 1\nprintf "%s\\n" "$*" "$AIRDESIGN_GATE_TEST"\n', { mode: 0o700 })
    const env = { ...process.env, PATH: `${directory}:${process.env.PATH}`, npm_config_allow_scripts: "agent-browser,esbuild", AIRDESIGN_GATE_TEST: "retained" }
    const result = spawnSync(process.execPath, ["scripts/gate/run.ts", "install"], { encoding: "utf8", env })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("ci\nretained\n")
    writeFileSync(join(directory, "plan.ts"), readFileSync("scripts/gate/plan.ts"))
    writeFileSync(join(directory, "original.ts"), readFileSync("scripts/gate/run.ts", "utf8").replace("  delete env.npm_config_allow_scripts\n", ""))
    expect(spawnSync(process.execPath, [join(directory, "original.ts"), "install"], { encoding: "utf8", env }).status).toBe(1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
