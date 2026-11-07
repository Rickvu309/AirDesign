import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { homedir } from "node:os"
import { join, resolve } from "node:path"
import { expect, it } from "vitest"

const sha = "a".repeat(40)
const project = "12345678-1234-4234-8234-123456789abc"
type Reply = { kind: "reply"; stdout: string; code: number } | { kind: "hang" }
const reply = (value: unknown): Reply => ({ kind: "reply", stdout: typeof value === "string" ? value : JSON.stringify(value), code: 0 })
const deployment = (service: string, status = "SUCCESS") => [{ id: `${service}-new`, status, meta: { commitHash: sha } }]
const listArgs = (service: string) => ["deployment", "list", "--project", project, "--environment", "production", "--service", service, "--limit", "20", "--json"]
const redeployArgs = (service: string) => ["deployment", "redeploy", "--project", project, "--environment", "production", "--service", service, "--commit", sha, "--yes"]
const ghCall = { file: "gh", args: ["api", "repos/owner/repo/commits/main", "--jq", ".sha"] }
const railwayCall = (args: string[]) => ({ file: "railway", args })
const initialCalls = [ghCall, railwayCall(listArgs("worker")), railwayCall(redeployArgs("worker")), railwayCall(listArgs("web")), railwayCall(redeployArgs("web"))]

async function runController(railway: Reply[], gh: Reply[] = [reply(sha)], commandTimeoutMs = 5_000) {
  await mkdir(join(homedir(), "tmp"), { recursive: true })
  const directory = await mkdtemp(join(homedir(), "tmp/railway-cli-"))
  const bin = join(directory, "bin")
  const output = join(directory, "github-output")
  const requests: string[] = []
  const server = createServer((request, response) => {
    requests.push(request.url ?? "")
    response.setHeader("content-type", "application/json")
    response.end(JSON.stringify({ sha }))
  })
  try {
    await mkdir(bin)
    await writeFile(output, "")
    for (const [file, queue] of [["railway", railway], ["gh", gh]] as const) {
      await writeFile(join(directory, `${file}.json`), JSON.stringify(queue))
      await writeFile(join(bin, file), `#!${process.execPath}
import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
const file = basename(process.argv[1])
const directory = process.env.FAKE_DIRECTORY
appendFileSync(join(directory, "calls.jsonl"), JSON.stringify({ file, args: process.argv.slice(2) }) + "\\n")
const path = join(directory, file + ".json")
const queue = JSON.parse(readFileSync(path, "utf8"))
const action = queue.shift()
writeFileSync(path, JSON.stringify(queue))
if (!action) process.exit(90)
if (action.kind === "hang") setInterval(() => {}, 1000)
else { process.stdout.write(action.stdout); process.exitCode = action.code }
`, { mode: 0o755 })
    }
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (address === null || typeof address === "string") throw new Error("missing-server-port")
    const result = await new Promise<{ code: number | null; stderr: string }>((resolveResult, reject) => {
      const child = spawn(process.execPath, ["scripts/release/railway-production.ts"], {
        cwd: resolve("."),
        env: {
          PATH: `${bin}:${process.env.PATH ?? ""}`, HOME: directory, TMPDIR: directory,
          EXPECT_SHA: sha, RAILWAY_PROJECT_ID: project, GITHUB_REPOSITORY: "owner/repo", GITHUB_OUTPUT: output,
          RELEASE_TIMEOUT_MS: "15000", RELEASE_COMMAND_TIMEOUT_MS: String(commandTimeoutMs),
          STUDIO_VERSION_URL: `http://127.0.0.1:${address.port}/version`, FAKE_DIRECTORY: directory,
        },
        stdio: ["ignore", "ignore", "pipe"],
        timeout: 18_000,
      })
      let stderr = ""
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk })
      child.on("error", reject)
      child.on("close", code => resolveResult({ code, stderr }))
    })
    const calls: unknown = (await readFile(join(directory, "calls.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line))
    const receipt: unknown = JSON.parse(await readFile(join(directory, "tmp/airdesign-live-verify/receipt/railway-deploy.json"), "utf8"))
    return { ...result, calls, receipt, output: await readFile(output, "utf8"), requests }
  } finally {
    await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()))
    await rm(directory, { recursive: true, force: true })
  }
}

it("runs the real CLI with worker then web GitHub redeploys and writes readiness only after Studio", async () => {
  const result = await runController([reply([]), reply(""), reply([]), reply(""), reply(deployment("worker")), reply(deployment("web"))])
  expect(result).toMatchObject({ code: 0, stderr: "", output: "ready=true\n", requests: ["/version"] })
  expect(result.calls).toEqual([...initialCalls, railwayCall(listArgs("worker")), railwayCall(listArgs("web"))])
  expect(result.receipt).toEqual({ sha, outcome: "ready", elapsedMs: expect.any(Number), observed: { worker: deployment("worker"), web: deployment("web") } })
})

it("exits unsuccessfully with a receipt when a new service deployment fails", async () => {
  const result = await runController([reply([]), reply(""), reply([]), reply(""), reply(deployment("worker")), reply(deployment("web", "FAILED"))])
  expect(result.code).toBe(1)
  expect(result.stderr).toContain("railway-deployment-failed: web")
  expect(result.calls).toEqual([...initialCalls, railwayCall(listArgs("worker")), railwayCall(listArgs("web"))])
  expect(result.receipt).toMatchObject({ sha, outcome: "failed", observed: { web: deployment("web", "FAILED") } })
  expect(result.output).toBe("")
  expect(result.requests).toEqual([])
})

it.each(["gh", "railway"] as const)("converts a nonzero %s subprocess exit and retains a failed receipt", async file => {
  const failure: Reply = { kind: "reply", stdout: "", code: 17 }
  const result = file === "gh" ? await runController([], [failure]) : await runController([reply([]), failure])
  expect(result.code).toBe(1)
  expect(result.stderr).toContain(`release-command-failed: ${file} ${file === "gh" ? "api repos/owner/repo/commits/main" : "deployment redeploy"}`)
  expect(result.calls).toEqual(file === "gh" ? [ghCall] : initialCalls.slice(0, 3))
  expect(result.receipt).toMatchObject({ sha, outcome: "failed" })
  expect(result.output).toBe("")
  expect(result.requests).toEqual([])
})

it("terminates a hung Railway command through the configured subprocess deadline", async () => {
  const result = await runController([reply([]), { kind: "hang" }], [reply(sha)], 1_000)
  expect(result.code).toBe(1)
  expect(result.stderr).toContain("release-command-failed: railway deployment redeploy")
  expect(result.calls).toEqual(initialCalls.slice(0, 3))
  expect(result.receipt).toMatchObject({ sha, outcome: "failed", elapsedMs: expect.any(Number) })
  expect(result.output).toBe("")
  expect(result.requests).toEqual([])
})

it("rejects a malformed deployment-list JSON shape at the real CLI boundary", async () => {
  const result = await runController([reply({ deployments: [] })])
  expect(result.code).toBe(1)
  expect(result.stderr).toContain("ZodError")
  expect(result.calls).toEqual(initialCalls.slice(0, 2))
  expect(result.receipt).toMatchObject({ sha, outcome: "failed" })
  expect(result.output).toBe("")
  expect(result.requests).toEqual([])
})
