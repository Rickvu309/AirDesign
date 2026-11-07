import { parse } from "yaml"
import { z } from "zod"
import { unitShards, verificationShards } from "../gate/plan.ts"

const stepSchema = z.object({ run: z.string().optional(), uses: z.string().optional(), if: z.string().optional() })
const jobSchema = z.object({
  steps: z.array(stepSchema).optional(),
  if: z.string().optional(),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  strategy: z.object({ matrix: z.union([z.string(), z.object({ shard: z.array(z.string()).optional(), check: z.array(z.string()).optional() })]).optional() }).optional(),
})
const workflowSchema = z.object({ jobs: z.record(z.string(), jobSchema) })

export function ciCoverageHits(scripts: Record<string, string>, source: string, testConfig: string): string[] {
  const workflow = workflowSchema.parse(parse(source))
  const jobs = workflow.jobs
  const hits: string[] = []
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
