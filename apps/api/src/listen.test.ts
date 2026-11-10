import { execFile, spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { connect, createServer } from "node:net"
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
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PUBLIC_ORIGIN: "https://app.example",
    SITE_ORIGIN: "https://site.example",
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

  async function refusedStart(
    values: Record<string, string | undefined>,
  ): Promise<{ readonly code: number | null; readonly stderr: string }> {
    const info = await postgresInfo()
    const port = await freePort()
    const running = spawnEntry(
      childEnv({
        PORT: String(port),
        SESSION_DATABASE_URL: info.session,
        DECK_DATABASE_URL: info.deck,
        LISTEN_DATABASE_URL: info.listen,
        ...values,
      }),
    )
    child = running
    let limit: NodeJS.Timeout | undefined
    const result = await Promise.race([
      stopped(running),
      new Promise<{ code: number | null; stderr: string }>((resolve) => {
        limit = setTimeout(() => resolve({ code: null, stderr: "" }), 15_000)
      }),
    ])
    clearTimeout(limit)
    running.kill()
    child = undefined
    return result
  }

  const notOrigins = [undefined, "", "http://app.example", "https://app.example/path", "https://app.example/", "app"]

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
    expect(result.stderr).toBe("DECK_DATABASE_URL\n")
    expect(result.stderr.includes("postgres://")).toBe(false)
    for (const url of [info.session, info.listen]) {
      expect(result.stderr.includes(url)).toBe(false)
      const parsed = new URL(url)
      expect(result.stderr.includes(decodeURIComponent(parsed.username))).toBe(false)
      expect(result.stderr.includes(decodeURIComponent(parsed.password))).toBe(false)
    }
  })

  it("exits when a database url is empty", async () => {
    const info = await postgresInfo()
    const urls = {
      SESSION_DATABASE_URL: info.session,
      DECK_DATABASE_URL: info.deck,
      LISTEN_DATABASE_URL: info.listen,
    }
    for (const name of Object.keys(urls)) {
      child = spawnEntry(childEnv({ ...urls, [name]: "" }))
      const result = await stopped(child)
      child = undefined
      expect(result.code).toBe(1)
      expect(result.stderr).toBe(`${name}\n`)
    }
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

  it("exits when the port is not a port", async () => {
    const info = await postgresInfo()
    for (const port of ["0", "abc", "70000", "1e4", "0x1F90", " 8080"]) {
      child = spawnEntry(
        childEnv({
          PORT: port,
          SESSION_DATABASE_URL: info.session,
          DECK_DATABASE_URL: info.deck,
          LISTEN_DATABASE_URL: info.listen,
        }),
      )
      const result = await Promise.race([
        stopped(child),
        new Promise<{ code: number | null; stderr: string }>((resolve) => {
          setTimeout(() => resolve({ code: null, stderr: "" }), 5000)
        }),
      ])
      child.kill()
      child = undefined
      expect(result.code).toBe(1)
      expect(result.stderr).toBe("PORT\n")
    }
  }, 40_000)

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

  it("exits when the public origin is missing or not an origin", async () => {
    for (const value of notOrigins) {
      const result = await refusedStart({ PUBLIC_ORIGIN: value })
      expect(result.code).toBe(1)
      expect(result.stderr).toBe("PUBLIC_ORIGIN\n")
    }
  }, 60_000)

  it("exits when the site origin is missing or not an origin", async () => {
    for (const value of notOrigins) {
      const result = await refusedStart({ SITE_ORIGIN: value })
      expect(result.code).toBe(1)
      expect(result.stderr).toBe("SITE_ORIGIN\n")
    }
  }, 60_000)

  it("exits when the cookie domain is not a host name", async () => {
    for (const value of ["app.example; SameSite=None", "https://app.example", "app example"]) {
      const result = await refusedStart({ COOKIE_DOMAIN: value })
      expect(result.code).toBe(1)
      expect(result.stderr).toBe("COOKIE_DOMAIN\n")
    }
  }, 60_000)

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
