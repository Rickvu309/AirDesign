import { spawn, type ChildProcess } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { accessPolicy } from "../../../../packages/access/src/access-policy.ts"
import { startServer, type RunningServer } from "../../../server/src/main.ts"

const root = path.resolve(import.meta.dirname, "../../../..")
const evidence = path.join(process.env.HOME ?? "", "tmp/airdesign-autopilot/P01")
const session = `p01-link-${process.pid}`

describe("browser link route", () => {
  let api: RunningServer | null = null
  let vite: ChildProcess | null = null
  let now = Date.now()

  afterAll(async () => {
    await browser(["close"], true)
    if (vite?.pid) {
      try {
        process.kill(-vite.pid, "SIGTERM")
      } catch {
        vite.kill("SIGTERM")
      }
    }
    await api?.close()
  })

  it("signs in from a link, reloads that url, and recovers a day-old intent on a phone", async () => {
    await mkdir(path.join(evidence, "lane-10"), { recursive: true })
    const studioPort = await freePort()
    process.env.AIRDESIGN_EXPOSE_INBOX = "1"
    api = await startServer(0, { operationsPath: ":memory:", historyPath: "memory://", accessPath: "memory://", clock: () => now, publicOrigin: `http://127.0.0.1:${studioPort}` })
    vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(studioPort), "--strictPort"], {
      cwd: path.join(root, "apps/studio"),
      env: { ...process.env, AIRDESIGN_API_ORIGIN: `http://127.0.0.1:${api.port}` },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    })
    const studio = `http://127.0.0.1:${studioPort}`
    await waitFor(studio)
    const email = "link@example.com"
    const first = await issuedLink(email, "import")
    await browser(["set", "viewport", "1440", "900"])
    await browser(["open", `${studio}${first.linkPath}`])
    await browser(["wait", "#shell"])
    expect(await browser(["get", "text", "h1"])).toContain("No decks yet")
    expect(await browser(["get", "text", ".ad-intent"])).toContain("Import a PowerPoint")
    expect(await browser(["get", "url"])).not.toContain("/access/link")
    await browser(["screenshot", path.join(evidence, "lane-10/desktop-link.png")])
    await browser(["reload"])
    await browser(["wait", "#shell"])
    expect(await browser(["get", "text", "h1"])).toContain("No decks yet")
    expect(await browser(["get", "text", ".ad-intent"])).toContain("Import a PowerPoint")
    expect(await browser(["get", "url"])).not.toContain("/access/link")
    await browser(["click", "button.ad-button-settings"])
    await browser(["wait", "button.ad-button-danger"])
    await browser(["scrollintoview", "button.ad-button-danger"])
    await browser(["click", "button.ad-button-danger"])
    await browser(["wait", "[data-screen=signin]"])
    expect(await browser(["get", "url"])).not.toContain("/access/link")
    await browser(["reload"])
    await browser(["wait", "[data-screen=signin]"])
    expect(await browser(["get", "text", "h1"])).toContain("Sign in")
    now += accessPolicy.resendWaitMs
    await browser(["fill", "input[type=email]", email])
    await clickUntil("button.ad-button-primary", "[data-screen=check]")
    await submitCode(email)
    await browser(["wait", "#shell"])
    expect(await browser(["get", "text", "h1"])).toContain("No decks yet")
    expect(await browser(["get", "url"])).not.toContain("/access/link")
    await browser(["open", `${studio}${first.linkPath}`])
    await browser(["wait", "[data-link-status=link-used]"])
    expect(await browser(["eval", "document.querySelector('#shell') ? 'shell' : 'gone'"])).toContain("gone")
    expect(await browser(["get", "text", ".ad-intent"])).toContain("Your place is saved.")
    now += accessPolicy.resendWaitMs
    const expired = await issuedLink(email, "import")
    now += accessPolicy.linkTtlMs + 1
    await browser(["open", `${studio}${expired.linkPath}`])
    await browser(["wait", "[data-link-status=link-expired]"])
    expect(await browser(["get", "text", "h1"])).toContain("This link has expired")
    expect(await browser(["get", "text", ".ad-intent"])).toContain("Import a PowerPoint")
    await browser(["screenshot", path.join(evidence, "lane-10/desktop-link-expired.png")])
    await browser(["set", "viewport", "320", "720"])
    const lateEmail = "late-link@example.com"
    const late = await issuedLink(lateEmail, "import")
    now += accessPolicy.intentTtlMs + 1
    await browser(["open", `${studio}${late.linkPath}`])
    await browser(["wait", "[data-link-status=link-expired]"])
    expect(await browser(["eval", "String(window.innerWidth)"])).toContain("320")
    expect(await browser(["get", "text", "h1"])).toContain("This link has expired")
    expect(await browser(["get", "text", ".ad-intent"])).toContain("Import a PowerPoint")
    await browser(["screenshot", path.join(evidence, "lane-10/phone-link-expired.png")])
    await clickUntil("button.ad-button-primary", "[data-screen=signin]")
    await browser(["fill", "input[type=email]", lateEmail])
    await clickUntil("button.ad-button-primary", "[data-screen=check]")
    await submitCode(lateEmail)
    await browser(["wait", "#shell"])
    expect(await browser(["get", "text", "h1"])).toContain("No decks yet")
    expect(await browser(["get", "text", ".ad-intent"])).toContain("Import a PowerPoint")
    expect(await browser(["get", "url"])).not.toContain("/access/link")
    await browser(["screenshot", path.join(evidence, "lane-10/phone-link.png")])
    await browser(["reload"])
    await browser(["wait", "#shell"])
    expect(await browser(["get", "text", ".ad-intent"])).toContain("Import a PowerPoint")
  }, 240_000)

  async function submitCode(email: string): Promise<void> {
    const code = await latestCode(email)
    await browser(["click", ".ad-code-box"])
    await browser(["keyboard", "type", code])
  }

  function runningApi(): RunningServer {
    if (!api) {
      throw new Error("api-not-started")
    }
    return api
  }

  async function issuedLink(email: string, kind: string): Promise<{ linkPath: string }> {
    const server = runningApi()
    const base = `http://127.0.0.1:${server.port}`
    const issued = await post(base, "/api/access/intent", { kind })
    const intent = await issued.json() as { token: string }
    const sent = await post(base, "/api/access/email", { email, intent: intent.token })
    expect(sent.status).toBe(200)
    const inbox = await fetch(`${base}/api/dev/inbox?to=${encodeURIComponent(email)}`)
    const messages = await inbox.json() as { messages: Array<{ linkPath: string; code: string }> }
    const message = messages.messages.at(-1)
    expect(message?.linkPath).toBeTruthy()
    return { linkPath: message?.linkPath ?? "" }
  }

  async function latestCode(email: string): Promise<string> {
    const server = runningApi()
    const inbox = await fetch(`http://127.0.0.1:${server.port}/api/dev/inbox?to=${encodeURIComponent(email)}`)
    const messages = await inbox.json() as { messages: Array<{ code: string }> }
    const code = messages.messages.at(-1)?.code ?? ""
    expect(code).toMatch(/^\d{6}$/)
    return code
  }
})

async function clickUntil(selector: string, ready: string): Promise<void> {
  const started = Date.now()
  let last = ""
  while (Date.now() - started < 15_000) {
    const clicked = await browser(["click", selector], true)
    const found = await browser(["eval", `document.querySelector(${JSON.stringify(ready)}) ? "yes" : document.body.innerText.slice(0, 240)`], true)
    if (found.includes("yes")) {
      return
    }
    last = `${clicked}\n${found}`
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  const url = await browser(["get", "url"], true)
  throw new Error(`missing ${ready}\n${url}\n${last}`)
}

function post(base: string, route: string, body: unknown): Promise<Response> {
  return fetch(`${base}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function browser(args: string[], allowFailure = false): Promise<string> {
  const child = spawn("agent-browser", ["--session", session, ...args], {
    env: {
      ...process.env,
      PATH: `${process.env.HOME ?? ""}/tmp/airdesign-autopilot/P01/tools/bin:${process.env.PATH ?? ""}`,
    },
  })
  let stdout = ""
  let stderr = ""
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk
  })
  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code !== 0 && !allowFailure) {
        reject(new Error(`${args.join(" ")}\n${stdout}\n${stderr}`))
        return
      }
      resolve(stdout.trim())
    })
  })
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.on("error", reject)
  })
}

async function waitFor(url: string): Promise<void> {
  const started = Date.now()
  let last = ""
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
      last = String(response.status)
    } catch (error) {
      last = error instanceof Error ? error.message : "fetch-failed"
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`studio-not-ready ${last}`)
}
