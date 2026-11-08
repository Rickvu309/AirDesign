import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { expect, it } from "vitest"
import { deploymentWorkflowHits, railwayControllerHits, ciCoverageHits, verifierBuildHits, workerLibraryHits, railwayKnownHostsHits } from "../../scripts/lint/ci-workflow-policy.ts"
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

it("rejects the shallow checkout that hid the design-parity merge base from unit and design jobs", () => {
  expect(hits(scripts, workflow)).toEqual([])
  const shallow = workflow.replaceAll("          fetch-depth: 0\n          persist-credentials: false", "          persist-credentials: false")
  expect(hits(scripts, shallow)).toEqual(expect.arrayContaining(["ci-merge-base-history-missing: unit", "ci-merge-base-history-missing: design"]))
})

it("rejects verifiers that rebuild the shared artifact", () => {
  expect(hits({ ...scripts, "verify:mcp": "npm run build:mcp-renderer && vitest run" }, workflow)).toContain("ci-verifier-rebuilds: verify:mcp")
})

it("rejects the runner mirror that stalled the real LibreOffice check", () => {
  expect(hits(scripts, workflow.replace("https://archive.ubuntu.com/ubuntu/", "http://azure.archive.ubuntu.com/ubuntu/"))).toContain("ci-office-downloads-need-direct-mirror-and-bounded-network-waits")
  expect(hits(scripts, workflow.replace("Acquire::https::Timeout=30", ""))).toContain("ci-office-downloads-need-direct-mirror-and-bounded-network-waits")
})

it("keeps nested workspace dependencies in every test job", () => {
  expect(hits(scripts, workflow.replaceAll("build/version.json", ""))).toContain("ci-artifact-missing-build-identity")
  for (const workspace of ["apps", "packages"]) {
    expect(hits(scripts, workflow.replace(`${workspace}/*/node_modules`, ""))).toContain(`ci-artifact-missing-workspace-dependencies: ${workspace}`)
  }
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

it("requires the single deploy controller and rejects native CI wait cycles", () => {
  const deploy = readFileSync(".github/workflows/deploy.yml", "utf8")
  const railway = readFileSync(".railway/railway.ts", "utf8")
  expect(deploymentWorkflowHits(deploy, railway)).toEqual([])
  expect(deploymentWorkflowHits(deploy, railway.replace("checkSuites: false", "checkSuites: true"))).toContain("deploy-native-ci-wait-cycle: disable native autodeploy and CI wait")
  expect(deploymentWorkflowHits(deploy, railway.replace("checkSuites: false", "checkSuites: false, autoDeploy: true"))).not.toEqual([])
  for (const broken of [
    deploy.replace("workflow_run:", "deployment_status:"),
    deploy.replace("branches: [main]", "branches: [preview]"),
    deploy.replace("cancel-in-progress: false", "cancel-in-progress: true"),
    deploy.replace("group: production", "group: ${{ github.run_id }}"),
    deploy.replace("environment: airdesign / production", "environment: production"),
    deploy.replace("node scripts/release/railway-production.ts", "echo skipped"),
    deploy.replace("npm run verify:live", "echo skipped"),
    deploy.replace("--smoke-email smoke@airdesign.app", ""),
    deploy.replace("libreoffice-impress", ""),
    deploy.replace("--with-deps chromium", ""),
    deploy.replaceAll("github.event.workflow_run.head_sha", "github.sha"),
    deploy.replace("secrets.RAILWAY_API_TOKEN", "secrets.RAILWAY_TOKEN"),
    deploy.replace("secrets.RAILWAY_SSH_PRIVATE_KEY", ""),
    deploy.replace("actions/upload-artifact@", "actions/missing-artifact@"),
    deploy.replace("always() && steps.railway.outputs.ready", "steps.railway.outputs.ready"),
    deploy.replace('"$HOME/tmp/release-tools/node_modules/.bin/wrangler"', "npx wrangler"),
  ]) {
    expect(broken).not.toBe(deploy)
    expect(deploymentWorkflowHits(broken, railway)).not.toEqual([])
  }
  for (const condition of ["conclusion == 'success'", "event == 'push'", "head_branch == 'main'", "head_repository.full_name == github.repository"]) {
    expect(deploymentWorkflowHits(deploy.replace(condition, "false"), railway)).not.toEqual([])
  }
  for (const command of ["npm ci", "npm install --prefix", "npx --no-install playwright"]) {
    const broken = deploy.replace(`- run: ${command}`, `- env:\n          RAILWAY_API_TOKEN: \${{ secrets.RAILWAY_API_TOKEN }}\n        run: ${command}`)
    expect(deploymentWorkflowHits(broken, railway)).toContain("deploy-secret-not-consumed-by-step: RAILWAY_API_TOKEN")
  }
  const inherited = deploy.replace("env:\n  EXPECT_SHA:", "env:\n  RAILWAY_API_TOKEN: ${{ secrets.RAILWAY_API_TOKEN }}\n  EXPECT_SHA:")
  expect(deploymentWorkflowHits(inherited, railway)).toContain("deploy-secrets-must-be-step-scoped")
})

it("rejects the railway link step that a workspace token could not run in the first production deploy", () => {
  const deploy = readFileSync(".github/workflows/deploy.yml", "utf8")
  const railway = readFileSync(".railway/railway.ts", "utf8")
  const linked = deploy.replace('ssh-keygen -y -f "$HOME/.ssh/id_ed25519" > "$HOME/.ssh/id_ed25519.pub"', 'ssh-keygen -y -f "$HOME/.ssh/id_ed25519" > "$HOME/.ssh/id_ed25519.pub"\n          railway link --project "$RAILWAY_PROJECT_ID" --environment production --service web')
  expect(linked).not.toBe(deploy)
  expect(deploymentWorkflowHits(linked, railway)).toContain("deploy-railway-link-needs-account-token")
  expect(deploymentWorkflowHits(deploy.replace('--railway-project "$RAILWAY_PROJECT_ID" ', ""), railway)).toContain('deploy-live-command-required: --railway-project "$RAILWAY_PROJECT_ID"')
  expect(deploymentWorkflowHits(deploy.replace("--railway-environment production ", ""), railway)).toContain("deploy-live-command-required: --railway-environment production")
  const tokenOnKey = deploy.replace("          RAILWAY_SSH_PRIVATE_KEY: ${{ secrets.RAILWAY_SSH_PRIVATE_KEY }}\n", "          RAILWAY_SSH_PRIVATE_KEY: ${{ secrets.RAILWAY_SSH_PRIVATE_KEY }}\n          RAILWAY_API_TOKEN: ${{ secrets.RAILWAY_API_TOKEN }}\n")
  expect(tokenOnKey).not.toBe(deploy)
  expect(deploymentWorkflowHits(tokenOnKey, railway)).toContain("deploy-secret-not-consumed-by-step: RAILWAY_API_TOKEN")
})

it("pins Railway's SSH host key that a fresh runner refused to trust in the first green-asset deploy", () => {
  const deploy = readFileSync(".github/workflows/deploy.yml", "utf8")
  const railway = readFileSync(".railway/railway.ts", "utf8")
  const unpinned = deploy.replace('          install -m 600 .github/ssh/railway-known-hosts "$HOME/.ssh/known_hosts"\n', "")
  expect(unpinned).not.toBe(deploy)
  expect(deploymentWorkflowHits(unpinned, railway)).toContain("deploy-ssh-host-key-must-be-pinned")
  expect(deploymentWorkflowHits(deploy.replace("StrictHostKeyChecking yes", "StrictHostKeyChecking accept-new"), railway)).toContain("deploy-ssh-host-key-must-not-be-trusted-on-first-use")
  expect(deploymentWorkflowHits(deploy.replace("StrictHostKeyChecking yes", "StrictHostKeyChecking no"), railway)).toContain("deploy-ssh-host-key-must-not-be-trusted-on-first-use")
  for (const disabled of ["StrictHostKeyChecking  no\\n  StrictHostKeyChecking yes", "StrictHostKeyChecking=off\\n  StrictHostKeyChecking yes", "StrictHostKeyChecking\\tno\\n  StrictHostKeyChecking yes"]) {
    const broken = deploy.replace("StrictHostKeyChecking yes", disabled)
    expect(broken).not.toBe(deploy)
    expect(deploymentWorkflowHits(broken, railway)).toContain("deploy-ssh-host-key-must-not-be-trusted-on-first-use")
  }
  const knownHosts = readFileSync(".github/ssh/railway-known-hosts", "utf8")
  expect(railwayKnownHostsHits(knownHosts)).toEqual([])
  expect(railwayKnownHostsHits("")).not.toEqual([])
  expect(railwayKnownHostsHits(knownHosts.replace("ssh.railway.com", "*.railway.com"))).not.toEqual([])
  expect(railwayKnownHostsHits(knownHosts + "evil.example ssh-ed25519 AAAA\n")).not.toEqual([])
})

it("rejects local uploads in the Railway controller", () => {
  const source = readFileSync("scripts/release/railway-production.ts", "utf8")
  expect(railwayControllerHits(source)).toEqual([])
  expect(railwayControllerHits(source.replace('["deployment", "redeploy", ...common', '["up", ...common'))).toEqual(["deploy-controller-must-build-from-github"])
})
