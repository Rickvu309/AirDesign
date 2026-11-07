import { parse } from "yaml"
import { z } from "zod"
import { unitShards, verificationShards } from "../gate/plan.ts"

const stepSchema = z.object({ run: z.string().optional(), uses: z.string().optional(), if: z.string().optional(), env: z.record(z.string(), z.string()).optional(), with: z.object({ ref: z.string().optional(), "fetch-depth": z.number().optional() }).optional() })
const jobSchema = z.object({
  steps: z.array(stepSchema).optional(),
  env: z.record(z.string(), z.string()).optional(),
  environment: z.string().optional(),
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
  for (const name of ["unit", "design"]) {
    const checkout = jobs[name]?.steps?.find(step => step.uses?.startsWith("actions/checkout@"))
    if (checkout?.with?.["fetch-depth"] !== 0) hits.push(`ci-merge-base-history-missing: ${name}`)
  }
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
  const trigger = z.object({ workflows: z.array(z.string()), types: z.array(z.string()), branches: z.array(z.string()) }).safeParse(workflow.on.workflow_run)
  if (Object.keys(workflow.on).join() !== "workflow_run" || !trigger.success || trigger.data.workflows.join() !== "CI" || trigger.data.types.join() !== "completed" || trigger.data.branches.join() !== "main") hits.push("deploy-trigger-must-follow-main-ci")
  if (workflow.concurrency.group !== "production" || workflow.concurrency["cancel-in-progress"]) hits.push("deploy-must-queue-without-cancelling")
  if (/checkSuites:\s*true|autoDeploy:\s*true/.test(railway) || !/checkSuites:\s*false/.test(railway)) hits.push("deploy-native-ci-wait-cycle: disable native autodeploy and CI wait")
  if (!railway.includes('github("Rickvu309/AirDesign", { branch: "main", checkSuites: false })')) hits.push("deploy-must-preserve-github-source")
  const job = jobs.production
  if (Object.keys(jobs).join() !== "production" || job?.environment !== "airdesign / production") hits.push("deploy-single-production-job-required")
  for (const condition of ["github.event.workflow_run.conclusion == 'success'", "github.event.workflow_run.event == 'push'", "github.event.workflow_run.head_branch == 'main'", "github.event.workflow_run.head_repository.full_name == github.repository"]) {
    if (!job?.if?.includes(condition)) hits.push(`deploy-event-filter-required: ${condition}`)
  }
  if (workflow.env?.EXPECT_SHA !== "${{ github.event.workflow_run.head_sha }}" || job?.env?.AIRDESIGN_BUILD_SHA !== "${{ github.event.workflow_run.head_sha }}") hits.push("deploy-must-use-ci-sha")
  for (const env of [workflow.env, ...Object.values(jobs).map(value => value.env)]) {
    if (Object.values(env ?? {}).some(value => value.includes("secrets."))) hits.push("deploy-secrets-must-be-step-scoped")
  }
  const steps = job?.steps ?? []
  const controller = steps.findIndex(step => step.run === "node scripts/release/railway-production.ts")
  const pages = steps.findIndex(step => step.run?.includes("pages deploy"))
  const verify = steps.findIndex(step => step.run?.startsWith("npm run verify:live "))
  if (controller < 0 || pages <= controller || verify <= pages) hits.push("deploy-order-must-be-railway-pages-live")
  for (const [index, step] of steps.entries()) {
    const run = step.run ?? ""
    const allowed = run.includes("pages deploy") ? ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]
      : run.includes('> "$HOME/.ssh/id_ed25519"') ? ["RAILWAY_SSH_PRIVATE_KEY"]
      : run === "node scripts/release/railway-production.ts" || run.startsWith("npm run verify:live ") ? ["RAILWAY_API_TOKEN"] : []
    for (const [name, value] of Object.entries(step.env ?? {})) {
      if (value.includes("secrets.") && !allowed.includes(name)) hits.push(`deploy-secret-not-consumed-by-step: ${name}`)
    }
    if (/\bnpx\b/.test(run) && Object.values(step.env ?? {}).some(value => value.includes("secrets."))) hits.push("deploy-package-fetch-with-secrets")
    if (index > controller && /npm (?:ci|install)|playwright install|apt-get/.test(run)) hits.push("deploy-installers-must-precede-deployment")
    if (step.uses?.startsWith("actions/checkout@") && step.with?.ref !== "${{ github.event.workflow_run.head_sha }}") hits.push("deploy-checkout-must-use-ci-sha")
    if (/\brailway(?:\/cli@[^ ]+)? up\b/.test(run)) hits.push("deploy-must-build-from-github")
    if (/\brailway link\b/.test(run)) hits.push("deploy-railway-link-needs-account-token")
    if (step.uses && !step.uses.startsWith("./") && !/@[a-f0-9]{40}$/.test(step.uses)) hits.push(`deploy-action-not-pinned: ${step.uses}`)
  }
  const key = steps.find(step => step.run?.includes('> "$HOME/.ssh/id_ed25519"'))
  if (key?.if !== "always() && steps.railway.outputs.ready == 'true'") hits.push("deploy-ssh-key-must-install-after-pages-failure")
  const live = steps[verify]
  for (const command of ['--expect-sha "$EXPECT_SHA"', "--smoke-email smoke@airdesign.app", "--railway", '--railway-project "$RAILWAY_PROJECT_ID"', "--railway-environment production", "--output-dir"]) {
    if (!live?.run?.includes(command)) hits.push(`deploy-live-command-required: ${command}`)
  }
  if (live?.if !== "always() && steps.railway.outputs.ready == 'true'" || steps[pages]?.if !== "steps.railway.outputs.ready == 'true'") hits.push("deploy-live-must-follow-both-services-even-if-pages-fails")
  if (steps[controller]?.env?.RAILWAY_API_TOKEN !== "${{ secrets.RAILWAY_API_TOKEN }}" || live?.env?.RAILWAY_API_TOKEN !== "${{ secrets.RAILWAY_API_TOKEN }}" || live?.env?.RAILWAY_PROJECT_ID !== "${{ vars.RAILWAY_PROJECT_ID }}" || key?.env?.RAILWAY_SSH_PRIVATE_KEY !== "${{ secrets.RAILWAY_SSH_PRIVATE_KEY }}") hits.push("deploy-railway-credentials-required")
  if (!source.includes("playwright install --with-deps chromium") || !source.includes("libreoffice-impress") || !source.includes("AIRDESIGN_LIBREOFFICE: /usr/bin/libreoffice")) hits.push("deploy-live-needs-browser-and-office")
  if (!source.includes("npm run build --workspace @airdesign/site") || !steps[pages]?.run?.includes('--commit-hash "$EXPECT_SHA"') || !source.includes("--project-name airdesign")) hits.push("deploy-site-must-build-selected-commit")
  if (!steps.some(step => step.if === "always()" && step.uses?.startsWith("actions/upload-artifact@"))) hits.push("deploy-live-evidence-must-upload-on-failure")
  return hits
}
