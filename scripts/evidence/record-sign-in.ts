import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import path from "node:path"
import { startServer, type RunningServer } from "../../apps/server/src/main.ts"

const root = path.resolve(import.meta.dirname, "../..")
const evidence = path.join(process.env.HOME ?? "", "tmp/airdesign-autopilot/P01")
const frames = path.join(evidence, "review/frames")
const video = path.join(evidence, "review/sign-in.webm")
const session = `p01-evidence-${process.pid}`
let now = Date.now()
let api: RunningServer | null = null
let vite: ChildProcess | null = null

try {
  const studioPort = await freePort()
  process.env.AIRDESIGN_EXPOSE_INBOX = "1"
  api = await startServer(0, { clock: () => now, publicOrigin: `http://127.0.0.1:${studioPort}` })
  vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(studioPort), "--strictPort"], {
    cwd: path.join(root, "apps/studio"),
    env: { ...process.env, AIRDESIGN_API_ORIGIN: `http://127.0.0.1:${api.port}` },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  })
  const studio = `http://127.0.0.1:${studioPort}`
  await waitFor(studio)
  const email = "video@example.com"
  await mkdir(frames, { recursive: true })
  await browser(["set", "viewport", "1440", "900"])
  await browser(["open", studio])
  await browser(["wait", "[data-screen=signin]"])
  await browser(["fill", "input[type=email]", email])
  await browser(["screenshot", path.join(frames, "01-sign-in.png")])
  await clickUntil("button.ad-button-primary", "[data-screen=check]")
  await browser(["click", ".ad-code-box"])
  await browser(["keyboard", "type", "000000"])
  await browser(["wait", "[role=alert]"])
  await browser(["screenshot", path.join(frames, "02-wrong-code.png")])
  await browser(["screenshot", path.join(evidence, "lane-10/desktop-error.png")])
  const code = await latestCode(email)
  await browser(["click", ".ad-code-box"])
  await browser(["keyboard", "type", code])
  await browser(["wait", "#shell"])
  await browser(["screenshot", path.join(frames, "03-code-success.png")])
  await browser(["screenshot", path.join(evidence, "lane-10/desktop-home.png")])
  const linkEmail = "video-link@example.com"
  const linkIssued = await post("/api/access/intent", { kind: "import" })
  const linkIntent = await linkIssued.json() as { token: string }
  await post("/api/access/email", { email: linkEmail, intent: linkIntent.token })
  const linkPath = await latestLink(linkEmail)
  await browser(["open", `${studio}${linkPath}`])
  await browser(["wait", "#shell"])
  await browser(["screenshot", path.join(frames, "04-link.png")])
  await browser(["screenshot", path.join(evidence, "lane-10/desktop-link.png")])
  await encodeSignInVideo(frames, video)
  process.stdout.write(`recorded ${video}\n`)
} finally {
  await browser(["close"], true)
  if (vite?.pid) {
    try {
      process.kill(-vite.pid, "SIGTERM")
    } catch {
      vite.kill("SIGTERM")
    }
  }
  await api?.close()
}

async function encodeSignInVideo(directory: string, output: string): Promise<void> {
  const names = ["01-sign-in.png", "02-wrong-code.png", "03-code-success.png", "04-link.png"]
  const lines = names.flatMap((name) => [`file '${path.join(directory, name)}'`, "duration 1.5"])
  lines.push(`file '${path.join(directory, names[names.length - 1] ?? "")}'`)
  const list = path.join(directory, "list.txt")
  await writeFile(list, `${lines.join("\n")}\n`)
  await run(path.join(evidence, "tools/bin/ffmpeg"), [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", list,
    "-vf", "scale=1440:900,format=yuv420p",
    "-c:v", "libvpx",
    "-b:v", "1M",
    output,
  ])
}

function run(command: string, args: string[]): Promise<void> {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
  let stderr = ""
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk
  })
  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${code}\n${stderr.slice(-800)}`))
        return
      }
      resolve()
    })
  })
}

async function clickUntil(selector: string, ready: string): Promise<void> {
  const started = Date.now()
  let last = ""
  while (Date.now() - started < 15_000) {
    await browser(["click", selector], true)
    const found = await browser(["eval", `document.querySelector(${JSON.stringify(ready)}) ? "yes" : document.body.innerText.slice(0, 180)`], true)
    if (found.includes("yes")) {
      return
    }
    last = found
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`missing ${ready}\n${last}`)
}

function post(route: string, body: unknown): Promise<Response> {
  return fetch(`http://127.0.0.1:${api?.port ?? 0}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function latestCode(email: string): Promise<string> {
  const inbox = await fetch(`http://127.0.0.1:${api?.port ?? 0}/api/dev/inbox?to=${encodeURIComponent(email)}`)
  const messages = await inbox.json() as { messages: Array<{ code: string }> }
  const code = messages.messages.at(-1)?.code ?? ""
  if (!/^\d{6}$/.test(code)) {
    throw new Error("missing-code")
  }
  return code
}

async function latestLink(email: string): Promise<string> {
  const inbox = await fetch(`http://127.0.0.1:${api?.port ?? 0}/api/dev/inbox?to=${encodeURIComponent(email)}`)
  const messages = await inbox.json() as { messages: Array<{ linkPath: string }> }
  return messages.messages.at(-1)?.linkPath ?? ""
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
