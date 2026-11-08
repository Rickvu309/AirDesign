import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdir, writeFile, appendFile } from "node:fs/promises"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { setTimeout } from "node:timers/promises"
import { z } from "zod"
import { waitForDeploy } from "../live/wait-for-deploy.ts"

const deploymentsSchema = z.array(z.object({ id: z.string(), status: z.string(), meta: z.object({ commitHash: z.string().optional() }).nullable() }))
type Service = "worker" | "web"
type Deployment = z.infer<typeof deploymentsSchema>[number]
type Railway = {
  currentMain: () => Promise<string>
  deploy: (service: Service, sha: string) => Promise<void>
  deployments: (service: Service) => Promise<Deployment[]>
  studio: (sha: string, remainingMs: number) => Promise<void>
  pause: () => Promise<void>
  now: () => number
  receipt: (value: unknown) => Promise<void>
}

export async function deployProduction(sha: string, railway: Railway, timeoutMs = 1_200_000): Promise<"ready" | "stale"> {
  z.string().regex(/^[a-f0-9]{40}$/).parse(sha)
  const started = railway.now()
  const observed: Partial<Record<Service, Deployment[]>> = {}
  let outcome = "failed"
  try {
    if (await railway.currentMain() !== sha) {
      outcome = "stale"
      return "stale"
    }
    const previous: Record<Service, Set<string>> = { worker: new Set(), web: new Set() }
    for (const service of ["worker", "web"] as const) {
      previous[service] = new Set((await railway.deployments(service)).map(deployment => deployment.id))
      await railway.deploy(service, sha)
    }
    while (railway.now() - started < timeoutMs) {
      let ready = true
      for (const service of ["worker", "web"] as const) {
        const deployments = await railway.deployments(service)
        observed[service] = deployments
        const current = deployments.find(deployment => !previous[service].has(deployment.id) && deployment.meta?.commitHash === sha)
        if (current && ["FAILED", "CRASHED", "REMOVED", "REMOVING", "SKIPPED"].includes(current.status)) throw new Error(`railway-deployment-failed: ${service}`)
        if (current?.status !== "SUCCESS") ready = false
      }
      if (ready) {
        const remainingMs = timeoutMs - (railway.now() - started)
        if (remainingMs <= 0) break
        await railway.studio(sha, remainingMs)
        outcome = "ready"
        return "ready"
      }
      await railway.pause()
    }
    throw new Error("railway-deployment-timeout")
  } finally {
    await railway.receipt({ sha, outcome, elapsedMs: railway.now() - started, observed })
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = z.object({
    EXPECT_SHA: z.string(),
    RAILWAY_PROJECT_ID: z.string().uuid(),
    GITHUB_REPOSITORY: z.string(),
    GITHUB_OUTPUT: z.string(),
    HOME: z.string(),
    RELEASE_TIMEOUT_MS: z.coerce.number().int().positive().max(2_147_483_647).default(1_200_000),
    RELEASE_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().max(2_147_483_647).default(60_000),
    STUDIO_VERSION_URL: z.url().default("https://studio.airdesign.app/version"),
  }).parse(process.env)
  const signal = AbortSignal.timeout(env.RELEASE_TIMEOUT_MS)
  const command = async (file: string, args: string[]) => {
    try {
      return (await promisify(execFile)(file, args, { timeout: env.RELEASE_COMMAND_TIMEOUT_MS, maxBuffer: 1_048_576, signal })).stdout.trim()
    } catch {
      throw new Error(`release-command-failed: ${file} ${args.slice(0, 2).join(" ")}`)
    }
  }
  const common = ["--project", env.RAILWAY_PROJECT_ID, "--environment", "production"]
  const output = join(env.HOME, "tmp/airdesign-live-verify/receipt")
  await mkdir(output, { recursive: true })
  const result = await deployProduction(env.EXPECT_SHA, {
    currentMain: () => command("gh", ["api", `repos/${env.GITHUB_REPOSITORY}/commits/main`, "--jq", ".sha"]),
    deploy: async (service, sha) => { await command("railway", ["deployment", "redeploy", ...common, "--service", service, "--commit", sha, "--yes"]) },
    deployments: async service => deploymentsSchema.parse(JSON.parse(await command("railway", ["deployment", "list", ...common, "--service", service, "--limit", "20", "--json"]))),
    studio: (sha, timeoutMs) => waitForDeploy({ sha, timeoutMs, url: env.STUDIO_VERSION_URL }),
    pause: () => setTimeout(10_000),
    now: Date.now,
    receipt: async value => { await writeFile(join(output, "railway-deploy.json"), JSON.stringify(value, null, 2) + "\n") },
  }, env.RELEASE_TIMEOUT_MS)
  await appendFile(env.GITHUB_OUTPUT, `ready=${result === "ready"}\n`)
}
