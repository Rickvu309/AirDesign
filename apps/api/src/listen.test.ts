import { spawn, type ChildProcess } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { request } from "node:http"
import { connect, createServer } from "node:net"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { ask, postgresInfo } from "./harness.js"
import { openPool } from "./index.js"

const entry = path.join(process.cwd(), "apps/api/src/start.ts")
const sourceHooks = path.join(process.cwd(), "apps/api/src/source-hooks.ts")

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
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PUBLIC_ORIGIN: "https://app.example",
    SITE_ORIGIN: "https://site.example",
    MCP_RESOURCE: "https://mcp.example/mcp",
  }
  delete env.FORCE_COLOR
  delete env.NO_COLOR
  delete env.COOKIE_DOMAIN
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete env[name]
    else env[name] = value
  }
  return env
}

function spawnEntry(env: NodeJS.ProcessEnv, args: string[] = []): ChildProcess {
  return spawn(process.execPath, ["--import", sourceHooks, ...args, entry], {
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

function holdWatch(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, "127.0.0.1")
    const fail = (error: Error) => {
      socket.destroy()
      reject(error)
    }
    socket.once("error", fail)
    socket.once("connect", () => {
      socket.off("error", fail)
      socket.on("error", () => undefined)
      socket.write("POST /decks/watch HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 100000\r\n\r\n")
      resolve()
    })
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

  it("serves mcp on the hosts in API_HOSTS and keeps localhost without them", async () => {
    const info = await postgresInfo()
    const pool = openPool(info.session, "start-hosts")
    const email = `hosts${randomBytes(4).toString("hex")}@example.com`
    const token = randomBytes(16).toString("hex")
    try {
      await pool.query("insert into session.account (email) values ($1)", [email])
      await pool.query("insert into session.access (token, email, issued) values ($1, $2, now())", [
        createHash("sha256").update(token).digest("hex"),
        email,
      ])
    } finally {
      await pool.end()
    }
    const statusFor = async (port: number, host: string): Promise<number> =>
      new Promise((resolve, reject) => {
        const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
        const req = request(
          {
            hostname: "127.0.0.1",
            port,
            path: "/mcp",
            method: "POST",
            headers: {
              host,
              cookie: `airdesign.session=${token}`,
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              "content-length": String(Buffer.byteLength(payload)),
            },
          },
          (res) => {
            res.resume()
            res.on("end", () => resolve(res.statusCode ?? 0))
          },
        )
        req.on("error", reject)
        req.end(payload)
      })
    const started = async (hosts: string | undefined): Promise<number> => {
      const port = await freePort()
      child = spawnEntry(
        childEnv({
          PORT: String(port),
          SESSION_DATABASE_URL: info.session,
          DECK_DATABASE_URL: info.deck,
          LISTEN_DATABASE_URL: info.listen,
          RESEND_API_KEY: "test-key",
          RESEND_FROM: "sign-in@localhost",
          API_HOSTS: hosts,
        }),
      )
      await untilHealth(port, child)
      return port
    }
    const named = await started(" MCP.AirDesign.App, ,api.airdesign.app, ")
    expect(await statusFor(named, "mcp.airdesign.app")).toBe(200)
    expect(await statusFor(named, "MCP.AIRDESIGN.APP")).toBe(200)
    expect(await statusFor(named, "api.airdesign.app")).toBe(200)
    expect(await statusFor(named, "localhost")).toBe(403)
    child?.kill()
    const unset = await started(undefined)
    expect(await statusFor(unset, "localhost")).toBe(200)
    expect(await statusFor(unset, "mcp.airdesign.app")).toBe(403)
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
    expect(result.stderr).toBe("DECK_DATABASE_URL\n")
    expect(result.stderr.includes("postgres://")).toBe(false)
    for (const url of [info.session, info.listen]) {
      expect(result.stderr.includes(url)).toBe(false)
      const parsed = new URL(url)
      expect(result.stderr.includes(decodeURIComponent(parsed.username))).toBe(false)
      expect(result.stderr.includes(decodeURIComponent(parsed.password))).toBe(false)
    }
  })

  it("exits with one line naming a setting that has a value", async () => {
    const info = await postgresInfo()
    child = spawnEntry(
      childEnv({
        PORT: "abc",
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: info.deck,
        LISTEN_DATABASE_URL: info.listen,
      }),
    )
    const result = await stopped(child)
    child = undefined
    expect(result.code).toBe(1)
    expect(result.stderr).toBe("PORT\n")
  })

  it("exits on SIGINT", async () => {
    const info = await postgresInfo()
    const port = await freePort()
    child = spawnEntry(
      childEnv({
        PORT: String(port),
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: info.deck,
        LISTEN_DATABASE_URL: info.listen,
      }),
    )
    await untilHealth(port, child)
    const done = stopped(child)
    child.kill("SIGINT")
    const result = await done
    child = undefined
    expect(result.code).toBe(0)
  }, 20_000)

  it("exits on SIGTERM", async () => {
    const info = await postgresInfo()
    const port = await freePort()
    child = spawnEntry(
      childEnv({
        PORT: String(port),
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: info.deck,
        LISTEN_DATABASE_URL: info.listen,
      }),
    )
    await untilHealth(port, child)
    await holdWatch(port)
    const started = Date.now()
    const done = stopped(child)
    child.kill("SIGTERM")
    const result = await done
    child = undefined
    expect(result.code).toBe(0)
    expect(Date.now() - started).toBeLessThan(5000)
  }, 20_000)

  it("sends the sign-in mail through resend", async () => {
    const info = await postgresInfo()
    const port = await freePort()
    const email = `person${randomBytes(4).toString("hex")}@example.com`
    child = spawnEntry(
      childEnv({
        PORT: String(port),
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: info.deck,
        LISTEN_DATABASE_URL: info.listen,
        RESEND_API_KEY: undefined,
        RESEND_FROM: undefined,
      }),
    )
    await untilHealth(port, child)
    const response = await ask(`http://127.0.0.1:${String(port)}`, "POST", "/sign-in/email", { email })
    expect(response.status).toBe(500)
  }, 20_000)

  it("starts with an empty cookie domain", async () => {
    const info = await postgresInfo()
    const port = await freePort()
    child = spawnEntry(
      childEnv({
        PORT: String(port),
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: info.deck,
        LISTEN_DATABASE_URL: info.listen,
        COOKIE_DOMAIN: "",
      }),
    )
    await untilHealth(port, child)
    const health = await ask(`http://127.0.0.1:${String(port)}`, "GET", "/health")
    expect(health.status).toBe(200)
    expect(health.json).toEqual({ ok: true })
  }, 20_000)

  it("sets the cookie domain and link origin from the environment", async () => {
    const info = await postgresInfo()
    const port = await freePort()
    const stem = path.join(os.tmpdir(), `airdesign-resend-${randomBytes(4).toString("hex")}`)
    const preload = `${stem}.mjs`
    const capture = `${stem}.json`
    await mkdir(path.dirname(preload), { recursive: true })
    await writeFile(
      preload,
      [
        'import { writeFileSync } from "node:fs"',
        "globalThis.fetch = async (_url, init) => {",
        `  writeFileSync(${JSON.stringify(capture)}, String(init.body))`,
        '  return new Response("{}", { status: 200 })',
        "}",
        "",
      ].join("\n"),
    )
    const email = `person${randomBytes(4).toString("hex")}@example.com`
    try {
      child = spawnEntry(
        childEnv({
          PORT: String(port),
          SESSION_DATABASE_URL: info.session,
          DECK_DATABASE_URL: info.deck,
          LISTEN_DATABASE_URL: info.listen,
          RESEND_API_KEY: "test-key",
          RESEND_FROM: "sign-in@localhost",
          PUBLIC_ORIGIN: "https://link.example",
          SITE_ORIGIN: "https://home.example",
          COOKIE_DOMAIN: "link.example",
        }),
        ["--import", preload],
      )
      await untilHealth(port, child)
      const base = `http://127.0.0.1:${String(port)}`
      const response = await ask(base, "POST", "/sign-in/email", { email })
      expect(response.status).toBe(202)
      const posted = JSON.parse(await readFile(capture, "utf8")) as { readonly text: string }
      const link = posted.text.split("\n")[0] ?? ""
      expect(link.startsWith("https://link.example/sign-in/link?token=")).toBe(true)
      const url = new URL(link)
      const opened = await ask(base, "GET", `${url.pathname}${url.search}`)
      expect(opened.status).toBe(302)
      expect(opened.headers.location).toBe("/")
      expect(opened.headers["set-cookie"]?.[0]).toContain("; Domain=link.example")
      const used = await ask(base, "GET", `${url.pathname}${url.search}`)
      expect(used.headers.location).toBe("https://home.example/sign-in/expired")
    } finally {
      await rm(preload, { force: true })
      await rm(capture, { force: true })
    }
  }, 20_000)
})
