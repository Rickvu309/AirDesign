import { parse } from "yaml"
import { z } from "zod"
import { unitShards, verificationShards } from "../gate/plan.ts"

const stepSchema = z.object({ run: z.string().optional(), uses: z.string().optional(), if: z.string().optional(), env: z.record(z.string(), z.string()).optional(), with: z.object({ ref: z.string().optional() }).optional() })
const jobSchema = z.object({
  steps: z.array(stepSchema).optional(),
  env: z.record(z.string(), z.string()).optional(),
  if: z.string().optional(),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  strategy: z.object({ matrix: z.union([z.string(), z.object({ shard: z.array(z.string()).optional(), check: z.array(z.string()).optional() })]).optional() }).optional(),
})
const workflowSchema = z.object({ jobs: z.record(z.string(), jobSchema) })

export function ciCoverageHits(scripts: Record<string, string>, source: string, testConfig: string): string[] {
  const workflow = workflowSchema.parse(parse(source))
  const jobs = workflow.jobs
  const hits: string[] = []
  const office = jobs.verification?.steps?.find(step => step.if === "matrix.libreoffice")?.run ?? ""
  if (!office.includes("https://archive.ubuntu.com/ubuntu/") || !office.includes("Acquire::https::Timeout=30")) hits.push("ci-office-downloads-need-direct-mirror-and-bounded-network-waits")
  const artifact = jobs.setup?.steps?.find(step => step.run?.includes('tar -cf "$RUNNER_TEMP/gate-build.tar"'))?.run ?? ""
  if (!artifact.includes("build/version.json")) hits.push("ci-artifact-missing-build-identity")
  for (const workspace of ["apps", "packages"]) {
    if (!artifact.includes(`${workspace}/*/node_modules`)) hits.push(`ci-artifact-missing-workspace-dependencies: ${workspace}`)
  }
  const covered = verificationShards.flatMap(group => [...group.scripts])
  for (const name of Object.keys(scripts).filter(name => /^verify:pr-\d+$/.test(name))) {
    if (covered.filter(value => value === name).length !== 1) hits.push(`ci-verification-not-covered: ${name}`)
  }
  for (const name of covered) if (!scripts[name]) hits.push(`ci-verification-script-missing: ${name}`)
  if (scripts.test !== "vitest run") hits.push("ci-workspace-tests-must-use-unfiltered-vitest-discovery")
  if (!testConfig.includes("sequence: { sequencer: MeasuredSequencer }")) hits.push("ci-unit-shards-must-use-measured-durations")
  for (const workspace of ["apps", "packages"]) for (const extensions of ["ts,mts,cts,js,mjs,cjs", "tsx,jsx"]) {
    if (!testConfig.includes(`"${workspace}/**/*.{test,spec}.{${extensions}}"`)) hits.push(`ci-workspace-test-pattern-missing: ${workspace}:${extensions}`)
  }
  for (const command of ["install", "build", "setup", "lint", "typecheck", "unit", "verify"]) {
    if (scripts[`gate:${command}`] !== `node scripts/gate/run.ts ${command}`) hits.push(`ci-gate-script-drift: ${command}`)
  }
  if (scripts.gate !== "node scripts/gate/run.ts all") hits.push("ci-local-gate-script-drift")
  if (jobs.gate?.if !== "always()") hits.push("ci-final-gate-must-always-run")
  const matrix = jobs.unit?.strategy?.matrix
  if (typeof matrix !== "object" || JSON.stringify(matrix.shard) !== JSON.stringify(unitShards)) hits.push("ci-unit-shards-incomplete")
  if (!jobs.unit?.steps?.some(step => step.run === "npm run gate:unit -- ${{ matrix.shard }}")) hits.push("ci-unit-shards-not-executed")
  if (!jobs.unit?.steps?.some(step => step.uses === "./.github/actions/prepare-worker")) hits.push("ci-unit-worker-isolation-unavailable")
  if (!jobs.verification?.steps?.some(step => step.uses === "./.github/actions/prepare-worker" && step.if === "matrix.isolation")) hits.push("ci-verification-worker-isolation-unavailable")
  if (jobs.verification?.strategy?.matrix !== "${{ fromJSON(needs.setup.outputs.verification) }}") hits.push("ci-verification-matrix-not-derived-from-gate")
  if (!jobs.setup?.steps?.some(step => step.run?.includes("node scripts/gate/run.ts matrix"))) hits.push("ci-verification-matrix-not-produced")
  if (!jobs.verification?.steps?.some(step => step.run === "npm run gate:verify -- ${{ matrix.name }}")) hits.push("ci-verification-shards-not-executed")
  for (const name of ["setup", "static", "unit", "verification", "design"]) {
    if (!jobs.gate?.needs?.includes(name)) hits.push(`ci-final-gate-missing-dependency: ${name}`)
  }
  const checks = jobs.static?.strategy?.matrix
  if (typeof checks !== "object" || !checks.check?.includes("lint") || !checks.check.includes("typecheck")) hits.push("ci-static-checks-incomplete")
  for (const [name, value] of Object.entries(scripts)) {
    if (name.startsWith("verify:") && /\b(?:vite build|npm run build)/.test(value)) hits.push(`ci-verifier-rebuilds: ${name}`)
  }
  for (const job of Object.values(jobs)) for (const step of job.steps ?? []) {
    if (step.uses && !step.uses.startsWith("./") && !/@[a-f0-9]{40}$/.test(step.uses)) hits.push(`ci-action-not-pinned: ${step.uses}`)
  }
  return hits
}

export function verifierBuildHits(file: string, source: string): string[] {
  if (!/[/\\]scripts[/\\]verify-[^/\\]+\.mjs$/.test(file)) return []
  return /["']vite["']\s*,\s*["']build["']|["']run["']\s*,\s*["']build(?::[^"']*)?["']|scripts\/build-[^"']+\.mjs/.test(source) ? ["ci-verifier-rebuilds-shared-artifact"] : []
}

export function workerLibraryHits(file: string, source: string): string[] {
  if (!/apps\/worker\/src\/(?:isolation|export\/deliver)\.ts$/.test(file.replaceAll("\\", "/"))) return []
  return source.replaceAll(/\s/g, "").includes('"--ro-bind-try","/lib64","/lib64"') ? [] : ["worker-linux-loader-missing: mount optional /lib64 for x64 isolated processes"]
}

export function deploymentWorkflowHits(source: string, railway: string): string[] {
  const workflow = workflowSchema.extend({
    on: z.record(z.string(), z.unknown()),
    env: z.record(z.string(), z.string()).optional(),
    concurrency: z.object({ group: z.string(), "cancel-in-progress": z.boolean() }),
  }).parse(parse(source))
  const { jobs } = workflow
  const hits: string[] = []
  if (Object.keys(workflow.on).join() !== "deployment_status") hits.push("deploy-trigger-must-be-deployment-status-only")
  for (const condition of ["github.event.deployment_status.state == 'success'", "github.event.deployment.environment == 'airdesign / production'", "github.event.deployment.creator.login == 'railway-app[bot]'"]) {
    if (!jobs.revision?.if?.includes(condition)) hits.push(`deploy-event-filter-required: ${condition}`)
    if (!workflow.concurrency.group.includes(condition)) hits.push(`deploy-concurrency-filter-required: ${condition}`)
  }
  if (!workflow.concurrency["cancel-in-progress"] || !workflow.concurrency.group.includes("'production' || github.run_id")) hits.push("deploy-newer-production-must-cancel-older-without-unrelated-events")
  const revision = jobs.revision?.steps?.map(step => step.run ?? "").join("\n") ?? ""
  if (!revision.includes('gh api "repos/$REPOSITORY/commits/main"') || !revision.includes('"$latest" == "$EXPECT_SHA"') || jobs.site?.needs !== "revision" || jobs.site?.if !== "needs.revision.outputs.current == 'true'") hits.push("deploy-selected-commit-must-be-current-main")
  if (workflow.env?.EXPECT_SHA !== "${{ github.event.deployment.sha }}") hits.push("deploy-sha-must-come-from-deployment")
  for (const env of [workflow.env, ...Object.values(jobs).map(job => job.env)]) {
    if (Object.values(env ?? {}).some(value => value.includes("secrets."))) hits.push("deploy-secrets-must-be-step-scoped")
  }
  for (const job of Object.values(jobs)) for (const step of job.steps ?? []) {
    const allowed = step.run?.includes("pages deploy") ? ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]
      : step.run?.includes("railway link --project") ? ["RAILWAY_API_TOKEN", "RAILWAY_SSH_PRIVATE_KEY"]
      : step.run?.startsWith("npm run verify:live ") ? ["RAILWAY_API_TOKEN"] : []
    for (const [name, value] of Object.entries(step.env ?? {})) {
      if (value.includes("secrets.") && !allowed.includes(name)) hits.push(`deploy-secret-not-consumed-by-step: ${name}`)
    }
    if (step.uses?.startsWith("actions/checkout@") && step.with?.ref !== "${{ github.event.deployment.sha }}") hits.push("deploy-checkout-must-use-deployment-sha")
  }
  const site = jobs.site?.steps?.map(step => step.run ?? "").join("\n") ?? ""
  const live = jobs.live?.steps?.map(step => step.run ?? "").join("\n") ?? ""
  if (Object.values(jobs).some(job => job.steps?.some(step => /\brailway(?:\/cli@[^ ]+)? up\b/.test(step.run ?? "")))) hits.push("deploy-railway-source-owned: Railway deploys from GitHub")
  if (jobs.live?.if || jobs.live?.needs !== "site" || !live.includes("node scripts/live/wait-for-deploy.ts")) hits.push("deploy-live-required-after-site-and-railway-identity")
  for (const command of ["npm run verify:live", '--expect-sha "$EXPECT_SHA"', "--smoke-email smoke@airdesign.app", "--railway", "--output-dir"]) {
    if (!live.includes(command)) hits.push(`deploy-live-command-required: ${command}`)
  }
  if (!live.includes("playwright install --with-deps chromium") || !live.includes("libreoffice-impress") || !source.includes("AIRDESIGN_LIBREOFFICE: /usr/bin/libreoffice")) hits.push("deploy-live-needs-browser-and-office")
  const link = jobs.live?.steps?.find(step => step.run?.includes("railway link --project"))
  const verify = jobs.live?.steps?.find(step => step.run?.startsWith("npm run verify:live "))
  if (link?.env?.RAILWAY_API_TOKEN !== "${{ secrets.RAILWAY_API_TOKEN }}" || link.env.RAILWAY_SSH_PRIVATE_KEY !== "${{ secrets.RAILWAY_SSH_PRIVATE_KEY }}" || verify?.env?.RAILWAY_API_TOKEN !== "${{ secrets.RAILWAY_API_TOKEN }}") hits.push("deploy-live-needs-linked-railway-ssh-credentials")
  if (!jobs.live?.steps?.some(step => step.if === "always()" && step.uses?.startsWith("actions/upload-artifact@"))) hits.push("deploy-live-evidence-must-upload-on-failure")
  if (!site.includes("npm run build --workspace @airdesign/site") || !source.includes("AIRDESIGN_BUILD_SHA: ${{ github.event.deployment.sha }}") || !site.includes("--project-name airdesign")) hits.push("deploy-site-must-build-selected-commit")
  if (!/checkSuites:\s*true/.test(railway) || /checkSuites:\s*false/.test(railway)) hits.push("railway-source-must-wait-for-ci")
  for (const job of Object.values(jobs)) for (const step of job.steps ?? []) {
    if (step.uses && !step.uses.startsWith("./") && !/@[a-f0-9]{40}$/.test(step.uses)) hits.push(`deploy-action-not-pinned: ${step.uses}`)
  }
  return hits
}
