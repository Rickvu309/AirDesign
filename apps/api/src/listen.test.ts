import { execFile, spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

import { ask, postgresInfo } from "./harness.js"

const entry = path.join(process.cwd(), "apps/api/dist/start.js")

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (address === null || typeof address === "string") {
        server.close()
        reject(new Error("port"))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
}

function childEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete env[name]
    else env[name] = value
  }
  return env
}

function spawnEntry(env: NodeJS.ProcessEnv, args: string[] = []): ChildProcess {
  return spawn(process.execPath, [...args, entry], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
}

async function stopped(child: ChildProcess): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stderr = ""
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => resolve({ code, stderr }))
  })
}

async function untilHealth(port: number, child: ChildProcess): Promise<void> {
  const started = Date.now()
  let stderr = ""
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  for (;;) {
    if (child.exitCode !== null) throw new Error(`start exited ${child.exitCode}: ${stderr}`)
    try {
      const response = await ask(`http://127.0.0.1:${String(port)}`, "GET", "/health")
      if (response.status === 200) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    if (Date.now() - started > 5000) throw new Error(`health did not answer: ${stderr}`)
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

describe("start entry", () => {
  let child: ChildProcess | undefined

  beforeAll(async () => {
    await new Promise<void>((resolve, reject) => {
      execFile("pnpm", ["--filter", "@airdesign/api...", "build"], { cwd: process.cwd() }, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }, 60_000)

  afterEach(() => {
    child?.kill()
    child = undefined
  })

  it("starts on a port and answers a sign-in request", async () => {
    const info = await postgresInfo()
    const port = await freePort()
    const preload = path.join(os.tmpdir(), "airdesign-resend-listen.mjs")
    await mkdir(path.dirname(preload), { recursive: true })
    await writeFile(preload, ['globalThis.fetch = async () => new Response("{}", { status: 200 })', ""].join("\n"))
    const email = `person${randomBytes(4).toString("hex")}@example.com`
    child = spawnEntry(
      childEnv({
        PORT: String(port),
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: info.deck,
        LISTEN_DATABASE_URL: info.listen,
        RESEND_API_KEY: "test-key",
        RESEND_FROM: "sign-in@localhost",
      }),
      ["--import", preload],
    )
    await untilHealth(port, child)
    const response = await ask(`http://127.0.0.1:${String(port)}`, "POST", "/sign-in/email", { email })
    expect(response.status).toBe(202)
    expect(response.json).toEqual({ ok: true })
  }, 20_000)

  it("answers health when the database cannot be reached", async () => {
    const port = await freePort()
    const closed = await freePort()
    const database = `postgres://closed:closed@127.0.0.1:${String(closed)}/api`
    child = spawnEntry(
      childEnv({
        PORT: String(port),
        SESSION_DATABASE_URL: database,
        DECK_DATABASE_URL: database,
        LISTEN_DATABASE_URL: database,
      }),
    )
    await untilHealth(port, child)
    const health = await ask(`http://127.0.0.1:${String(port)}`, "GET", "/health")
    const opened = await ask(
      `http://127.0.0.1:${String(port)}`,
      "POST",
      "/decks/open",
      { deck: "deck" },
      "airdesign.session=missing",
    )
    expect(health.status).toBe(200)
    expect(health.json).toEqual({ ok: true })
    expect(opened.status).not.toBe(200)
  }, 20_000)

  it("exits when a database url is missing", async () => {
    const info = await postgresInfo()
    child = spawnEntry(
      childEnv({
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: undefined,
        LISTEN_DATABASE_URL: info.listen,
      }),
    )
    const result = await stopped(child)
    child = undefined
    expect(result.code).toBe(1)
    expect(result.stderr).toContain("DECK_DATABASE_URL")
  })
})
