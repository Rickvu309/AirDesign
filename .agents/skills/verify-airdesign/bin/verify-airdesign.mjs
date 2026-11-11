#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  appendFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { request as httpRequest, createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: skill, encoding: "utf8" }).trim()
const evidenceRoot = path.join(os.homedir(), "tmp", "verify-airdesign")
const scratchRoot = path.join(os.homedir(), "tmp", "verify-airdesign-scratch")
const webDist = path.join(repo, "apps/web/dist")
const apiDist = path.join(repo, "apps/api/dist")
const catalogDist = path.join(repo, "packages/catalog/dist/index.js")

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".ico": "image/x-icon",
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function evidenceDir(run) {
  return path.join(evidenceRoot, run)
}

function scratchDir(run) {
  return path.join(scratchRoot, run)
}

function statePath(run) {
  return path.join(scratchDir(run), "state.json")
}

function readState(run) {
  if (run === undefined) fail("name the run: verify-airdesign <command> <run>")
  if (!existsSync(statePath(run))) fail(`no running instance for run ${run}`)
  return JSON.parse(readFileSync(statePath(run), "utf8"))
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function commandLine(pid) {
  try {
    return readFileSync(`/proc/${String(pid)}/cmdline`, "utf8")
      .split("\0")
      .join(" ")
  } catch {
    return ""
  }
}

function ownsServe(state) {
  return alive(state.pid) && commandLine(state.pid).includes(`serve ${state.run}`)
}

function ownsPostgres(state) {
  return alive(state.postgres.pid) && commandLine(state.postgres.pid).includes(state.postgres.dataDir)
}

function head() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim()
}

function proof(run, line) {
  appendFileSync(path.join(evidenceDir(run), "proof.md"), `${line}\n`)
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function launch(args) {
  const run = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomBytes(3).toString("hex")}`
  mkdirSync(evidenceDir(run), { recursive: true })
  mkdirSync(scratchDir(run), { recursive: true })
  if (!args.includes("--no-build")) {
    const log = path.join(scratchDir(run), "build.log")
    for (const filter of [
      ["--filter", "@airdesign/api...", "run", "build"],
      ["--filter", "web", "build"],
    ]) {
      try {
        execFileSync("pnpm", filter, { cwd: repo, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 })
      } catch (error) {
        writeFileSync(log, `${String(error.stdout ?? "")}${String(error.stderr ?? "")}`)
        fail(`build failed: pnpm ${filter.join(" ")}. Log: ${log}`)
      }
    }
  }
  for (const built of [webDist, apiDist, catalogDist]) {
    if (!existsSync(built)) fail(`missing build output ${built}; run launch without --no-build`)
  }
  const log = path.join(scratchDir(run), "stack.log")
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve", run], {
    cwd: repo,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env, VERIFY_AIRDESIGN_LOG: log },
  })
  child.unref()
  for (let waited = 0; waited < 120_000; waited += 500) {
    if (existsSync(statePath(run))) {
      const state = readState(run)
      if (state.ready) {
        proof(run, `# verify-airdesign run ${run}\n\n- commit ${state.commit}\n- origin ${state.origin}`)
        process.stdout.write(
          `${JSON.stringify({ run, origin: state.origin, evidence: evidenceDir(run), pid: state.pid })}\n`,
        )
        return
      }
    }
    if (!alive(child.pid)) fail(`stack exited before ready. Log: ${log}`)
    await pause(500)
  }
  fail(`stack not ready after 120 s. Log: ${log}. Run: verify-airdesign stop ${run}`)
}

function forward(req, res, apiPort) {
  const outgoing = httpRequest(
    { host: "127.0.0.1", port: apiPort, method: req.method, path: req.url, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers)
      answer.pipe(res)
    },
  )
  outgoing.on("error", () => {
    res.writeHead(502)
    res.end()
  })
  req.pipe(outgoing)
}

function serveFile(pathname, res) {
  const wanted = path.join(webDist, path.normalize(decodeURIComponent(pathname)))
  const file =
    wanted.startsWith(webDist) && existsSync(wanted) && statSync(wanted).isFile()
      ? wanted
      : path.join(webDist, "index.html")
  res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" })
  createReadStream(file).pipe(res)
}

async function serve(run) {
  const log = (line) => appendFileSync(process.env.VERIFY_AIRDESIGN_LOG ?? "/dev/null", `${line}\n`)
  const load = (name) => import(pathToFileURL(path.join(apiDist, name)).href)
  const { startEmptyCluster } = await load("postgres-setup.js")
  const { runBootstrap, runSetup } = await load("provision.js")
  const { openPool } = await load("pool.js")
  const { DeckListen } = await load("listen.js")
  const { createApi, routes } = await load("server.js")
  const { LocalOriginalStore } = await load("local-original-store.js")
  const cluster = await startEmptyCluster()
  const role = (name) => `postgres://${name}:${randomBytes(18).toString("hex")}@127.0.0.1:${String(cluster.port)}/api`
  const environment = {
    ADMIN_DATABASE_URL: cluster.admin,
    SESSION_DATABASE_URL: role("session"),
    DECK_DATABASE_URL: role("deck"),
    LISTEN_DATABASE_URL: role("listen"),
    MIGRATOR_DATABASE_URL: role("migrator"),
  }
  const write = (_, line) => log(line)
  const admin = openPool(cluster.admin, "verify-admin")
  const found = await admin.query("select current_setting('data_directory') as dir")
  const dataDir = found.rows[0].dir
  const postgresPid = Number(readFileSync(path.join(dataDir, "postmaster.pid"), "utf8").split("\n")[0])
  const state = {
    run,
    pid: process.pid,
    commit: head(),
    postgres: { pid: postgresPid, dataDir, port: cluster.port },
    ready: false,
  }
  writeFileSync(statePath(run), JSON.stringify(state, null, 2))
  if ((await runBootstrap(environment, write)) !== 0) throw new Error("bootstrap")
  if ((await runSetup(environment, write)) !== 0) throw new Error("setup")
  const session = openPool(environment.SESSION_DATABASE_URL, "verify-session")
  const deck = openPool(environment.DECK_DATABASE_URL, "verify-deck")
  const listen = new DeckListen(environment.LISTEN_DATABASE_URL)
  const mailFile = path.join(scratchDir(run), "mail.jsonl")
  const api = createApi({
    session,
    deck,
    listen,
    publicOrigin: "https://app.example",
    siteOrigin: "https://site.example",
    resource: "https://mcp.example.test/mcp",
    commit: state.commit,
    originals: new LocalOriginalStore(),
    send: async (mail) => {
      appendFileSync(mailFile, `${JSON.stringify(mail)}\n`)
    },
  })
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve))
  const apiPort = api.address().port
  const apiPaths = new Set(routes.map((route) => route.path))
  const front = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://front").pathname
    if (apiPaths.has(pathname) && !(req.method === "GET" && pathname.startsWith("/oauth/authorize"))) {
      forward(req, res, apiPort)
      return
    }
    serveFile(pathname, res)
  })
  await new Promise((resolve) => front.listen(0, "127.0.0.1", resolve))
  const origin = `http://127.0.0.1:${String(front.address().port)}`
  let stopping = false
  const stop = async () => {
    if (stopping) return
    stopping = true
    front.close()
    front.closeAllConnections()
    api.close()
    api.closeAllConnections()
    await listen.close().catch(() => undefined)
    await Promise.all([session.end(), deck.end(), admin.end()]).catch(() => undefined)
    await cluster.stop().catch(() => undefined)
    process.exit(0)
  }
  process.on("SIGTERM", stop)
  process.on("SIGINT", stop)
  writeFileSync(statePath(run), JSON.stringify({ ...state, apiPort, origin, mail: mailFile, ready: true }, null, 2))
  log(`ready ${origin}`)
}

async function call(origin, method, pathname, body, cookie) {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: { "content-type": "application/json", ...(cookie === undefined ? {} : { cookie }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let json
  try {
    json = text.length === 0 ? {} : JSON.parse(text)
  } catch {
    json = { text: text.slice(0, 200) }
  }
  return { status: response.status, json, cookie: response.headers.getSetCookie()[0]?.split(";")[0] }
}

async function catalog() {
  return import(pathToFileURL(catalogDist).href)
}

async function doctor(run) {
  const state = readState(run)
  const { deckRoutes } = await catalog()
  const checks = {
    serveOwned: ownsServe(state),
    postgresOwned: ownsPostgres(state),
    ready: state.ready === true,
  }
  if (state.ready) {
    const page = await fetch(`${state.origin}/`)
      .then((r) => r.text())
      .catch(() => "")
    checks.webServed = page.includes("<title>AirDesign</title>")
    const version = await call(state.origin, "GET", "/version").catch(() => ({ json: {} }))
    checks.apiCommit = version.json.commit === state.commit
    checks.buildIsHead = state.commit === head()
    const list = await call(state.origin, "POST", deckRoutes.list.path, {}).catch(() => ({ json: {} }))
    checks.databaseAnswers = list.status === 401 && list.json.refusal === "session"
  }
  const ok = Object.values(checks).every(Boolean)
  process.stdout.write(`${JSON.stringify({ ok, run, origin: state.origin, checks })}\n`)
  if (!ok) process.exit(1)
}

async function signIn(state, email = `verify${randomBytes(4).toString("hex")}@example.com`) {
  const { signInRoutes } = await catalog()
  const asked = await call(state.origin, signInRoutes.email.method, signInRoutes.email.path, { email })
  if (asked.status !== 202) throw new Error(`sign-in email answered ${String(asked.status)}`)
  const mails = readFileSync(state.mail, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
  const code = mails
    .filter((mail) => mail.to === email)
    .at(-1)
    ?.text.split("\n")[1]
  const signed = await call(state.origin, signInRoutes.code.method, signInRoutes.code.path, { email, code })
  if (signed.status !== 200 || signed.cookie === undefined)
    throw new Error(`sign-in code answered ${String(signed.status)}`)
  return { email, cookie: signed.cookie }
}

async function apiCall(run, name, bodyText, cookie) {
  const state = readState(run)
  const { deckRoutes } = await catalog()
  const route = deckRoutes[name]
  if (route === undefined) fail(`unknown deck route ${name}; one of ${Object.keys(deckRoutes).join(", ")}`)
  const answer = await call(state.origin, "POST", route.path, JSON.parse(bodyText ?? "{}"), cookie)
  const file = path.join(evidenceDir(run), `api-${name}-${String(Date.now())}.json`)
  writeFileSync(file, JSON.stringify({ path: route.path, status: answer.status, json: answer.json }, null, 2))
  process.stdout.write(`${JSON.stringify({ status: answer.status, file })}\n`)
}

async function journey(run, name) {
  const state = readState(run)
  const file = path.join(skill, "journeys", `${name}.mjs`)
  if (!existsSync(file)) fail(`no journey ${name} in ${path.join(skill, "journeys")}`)
  const { chromium } = await import(pathToFileURL(path.join(repo, "node_modules/@playwright/test/index.mjs")).href)
  const { deckRoutes, signInRoutes } = await catalog()
  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL: state.origin, viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const out = path.join(evidenceDir(run), `${name}-${String(Date.now())}`)
  mkdirSync(out, { recursive: true })
  let step = 0
  const kit = {
    repo,
    origin: state.origin,
    page,
    context,
    deckRoutes,
    signInRoutes,
    async signIn() {
      const signed = await signIn(state)
      const split = signed.cookie.indexOf("=")
      await context.addCookies([
        {
          name: signed.cookie.slice(0, split),
          value: signed.cookie.slice(split + 1),
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        },
      ])
      return signed
    },
    async post(route, body, cookie) {
      const answer = await call(state.origin, "POST", route.path, body, cookie)
      step += 1
      writeFileSync(
        path.join(out, `${String(step).padStart(2, "0")}-api${route.path.replace(/\//g, "-")}.json`),
        JSON.stringify({ path: route.path, body, status: answer.status, json: answer.json }, null, 2),
      )
      return answer
    },
    async capture(label) {
      step += 1
      const stem = path.join(out, `${String(step).padStart(2, "0")}-${label}`)
      await page.screenshot({ path: `${stem}.png` })
      writeFileSync(`${stem}.aria.txt`, await page.locator("body").ariaSnapshot())
      return stem
    },
    note(line) {
      proof(run, `- ${name}: ${line}`)
    },
  }
  const { default: drive } = await import(pathToFileURL(file).href)
  let passed = false
  try {
    await drive(kit)
    passed = true
  } catch (error) {
    await kit.capture("failure").catch(() => undefined)
    proof(run, `- ${name}: FAILED ${String(error?.message ?? error).split("\n")[0]}`)
  } finally {
    await browser.close()
  }
  proof(run, `- ${name}: ${passed ? "PASSED" : "FAILED"}, artifacts ${out}`)
  process.stdout.write(`${JSON.stringify({ journey: name, passed, evidence: out })}\n`)
  if (!passed) process.exit(1)
}

async function stop(run) {
  if (run === undefined) fail("name the run: verify-airdesign stop <run>")
  const stateFile = statePath(run)
  if (!existsSync(stateFile)) {
    process.stdout.write(`${JSON.stringify({ run, stopped: [], note: "no state; nothing of this run is running" })}\n`)
    return
  }
  const state = JSON.parse(readFileSync(stateFile, "utf8"))
  const stopped = []
  if (ownsServe(state)) {
    process.kill(state.pid, "SIGTERM")
    for (let waited = 0; waited < 15_000 && alive(state.pid); waited += 250) await pause(250)
    if (alive(state.pid)) process.kill(state.pid, "SIGKILL")
    stopped.push(`serve ${String(state.pid)}`)
  }
  if (ownsPostgres(state)) {
    process.kill(state.postgres.pid, "SIGINT")
    for (let waited = 0; waited < 15_000 && alive(state.postgres.pid); waited += 250) await pause(250)
    stopped.push(`postgres ${String(state.postgres.pid)}`)
  }
  const left = [state.pid, state.postgres.pid].filter((pid) => alive(pid) && commandLine(pid).includes(run))
  const clusterDir = path.dirname(state.postgres.dataDir)
  if (path.basename(clusterDir).startsWith("airdesign-api-") && !ownsPostgres(state)) {
    rmSync(clusterDir, { recursive: true, force: true })
  }
  rmSync(scratchDir(run), { recursive: true, force: true })
  if (existsSync(evidenceDir(run))) proof(run, `- stopped: ${stopped.join(", ") || "nothing was running"}`)
  process.stdout.write(
    `${JSON.stringify({ run, stopped, left, evidence: evidenceDir(run), evidenceKept: existsSync(evidenceDir(run)) })}\n`,
  )
}

const [command, ...rest] = process.argv.slice(2)
const flag = (name) => {
  const at = rest.indexOf(name)
  return at === -1 ? undefined : rest[at + 1]
}

if (command === "launch") await launch(rest)
else if (command === "serve") await serve(rest[0])
else if (command === "doctor") await doctor(rest[0])
else if (command === "sign-in")
  process.stdout.write(`${JSON.stringify(await signIn(readState(rest[0]), flag("--email")))}\n`)
else if (command === "api") await apiCall(rest[0], rest[1], rest[2], flag("--cookie"))
else if (command === "journey") await journey(rest[0], rest[1])
else if (command === "stop") await stop(rest[0])
else {
  process.stdout.write(
    [
      "verify-airdesign launch [--no-build]        start web + api + postgres on free ports; prints run id",
      "verify-airdesign doctor <run>               read-only health check of that run",
      "verify-airdesign sign-in <run> [--email e]  sign in through the real email code; prints the cookie",
      "verify-airdesign api <run> <route> [json] [--cookie c]  POST a deckRoutes entry; saves the answer",
      "verify-airdesign journey <run> <name>       run journeys/<name>.mjs in Chromium; saves screenshots",
      "verify-airdesign stop <run>                 stop only this run's processes; keeps evidence",
      "",
    ].join("\n"),
  )
}
