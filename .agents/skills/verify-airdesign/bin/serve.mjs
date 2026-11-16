import { appendFileSync, createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { request as httpRequest, createServer } from "node:http"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { randomBytes } from "node:crypto"
import { scriptedAira } from "./scripted-aira.mjs"
import { fakeOrigins, moveLocation, siteFile, withAppOrigin } from "./site.mjs"

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

function forward(req, res, apiPort, countryHeader, origins) {
  const headers = { ...req.headers, [countryHeader]: req.headers[countryHeader] ?? "US" }
  const outgoing = httpRequest(
    { host: "127.0.0.1", port: apiPort, method: req.method, path: req.url, headers },
    (answer) => {
      const location = moveLocation(answer.headers.location, origins)
      res.writeHead(answer.statusCode ?? 502, location === undefined ? answer.headers : { ...answer.headers, location })
      answer.pipe(res)
    },
  )
  outgoing.on("error", () => {
    res.writeHead(502)
    res.end()
  })
  req.pipe(outgoing)
}

function serveFile(pathname, res, webDist) {
  const wanted = path.join(webDist, path.normalize(decodeURIComponent(pathname)))
  const file =
    wanted.startsWith(webDist) && existsSync(wanted) && statSync(wanted).isFile()
      ? wanted
      : path.join(webDist, "index.html")
  res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" })
  createReadStream(file).pipe(res)
}

function serveSite(pathname, res, siteDist, appOrigin) {
  const file = siteFile(siteDist, pathname)
  if (file === null) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found")
    return
  }
  const type = types[path.extname(file)] ?? "application/octet-stream"
  res.writeHead(200, { "content-type": type })
  if (type.startsWith("text/") || type === "image/svg+xml")
    res.end(withAppOrigin(readFileSync(file, "utf8"), appOrigin))
  else createReadStream(file).pipe(res)
}

const originalBase = "/verify-original"

function serveOriginal(originals, pathname, req, res) {
  const chunks = []
  req.on("data", (chunk) => chunks.push(chunk))
  req.on("end", () => {
    try {
      if (req.method === "PUT") {
        originals.put(pathname, new Uint8Array(Buffer.concat(chunks)), req.headers)
        res.writeHead(200).end()
        return
      }
      const bytes = originals.get(pathname)
      res.writeHead(200, { "content-type": "application/octet-stream" }).end(Buffer.from(bytes))
    } catch (error) {
      res.writeHead(req.method === "PUT" ? 412 : 404).end(String(error.message ?? error))
    }
  })
}

export async function serve(
  run,
  { repo, apiDist, webDist, siteDist, catalogDist, scratchDir, statePath, airaPath, head, choice },
) {
  const log = (line) => appendFileSync(process.env.VERIFY_AIRDESIGN_LOG ?? "/dev/null", `${line}\n`)
  const load = (name) => import(pathToFileURL(path.join(apiDist, name)).href)
  const { startEmptyCluster } = await load("postgres-setup.js")
  const { runBootstrap, runSetup } = await load("provision.js")
  const { openPool } = await load("pool.js")
  const { DeckListen } = await load("listen.js")
  const { createApi, routes } = await load("server.js")
  const { LocalOriginalStore } = await load("local-original-store.js")
  const { Replay } = await load("aira-replay.js")
  const { airaModel, airaEffort } = await load("aira.js")
  const { anthropicTransport } = await load("anthropic-transport.js")
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
    repo,
    commit: head(),
    aira: {
      streams: choice.keyEnv === undefined ? "recorded" : "real",
      model: choice.model ?? airaModel,
      effort: choice.effort ?? airaEffort,
    },
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
  const originals = new LocalOriginalStore(Date.now, originalBase)
  const api = createApi({
    session,
    deck,
    listen,
    publicOrigin: fakeOrigins.app,
    siteOrigin: fakeOrigins.site,
    resource: "https://mcp.example.test/mcp",
    commit: state.commit,
    originals,
    send: async (mail) => {
      appendFileSync(mailFile, `${JSON.stringify(mail)}\n`)
    },
    aira: {
      ...(choice.keyEnv === undefined
        ? scriptedAira({ Replay, repo, file: airaPath(run), log })
        : {
            on: true,
            key: process.env[choice.keyEnv],
            secret: randomBytes(32).toString("hex"),
            transport: anthropicTransport(),
            log,
          }),
      model: state.aira.model,
      effort: state.aira.effort,
    },
  })
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve))
  const apiPort = api.address().port
  const apiPaths = new Set(routes.map((route) => route.path))
  const { countryHeader, signInPaths, signOutPaths } = await import(pathToFileURL(catalogDist).href)
  const sitePaths = new Set([...signInPaths, ...signOutPaths])
  const origins = { app: "", site: "" }
  const site = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://front").pathname
    if (sitePaths.has(pathname)) forward(req, res, apiPort, countryHeader, origins)
    else serveSite(pathname, res, siteDist, origins.app)
  })
  const front = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://front").pathname
    if (pathname.startsWith(`${originalBase}/`)) {
      serveOriginal(originals, pathname, req, res)
      return
    }
    if (apiPaths.has(pathname) && !(req.method === "GET" && pathname.startsWith("/oauth/authorize"))) {
      forward(req, res, apiPort, countryHeader, origins)
      return
    }
    serveFile(pathname, res, webDist)
  })
  await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve))
  await new Promise((resolve) => front.listen(0, "127.0.0.1", resolve))
  origins.site = `http://127.0.0.1:${String(site.address().port)}`
  const origin = `http://127.0.0.1:${String(front.address().port)}`
  origins.app = origin
  let stopping = false
  const stop = async (why) => {
    if (stopping) return
    stopping = true
    log(`stopping: ${String(why)} at ${new Date().toISOString()}`)
    front.close()
    front.closeAllConnections()
    site.close()
    site.closeAllConnections()
    api.close()
    api.closeAllConnections()
    await listen.close().catch(() => undefined)
    await Promise.all([session.end(), deck.end(), admin.end()]).catch(() => undefined)
    await cluster.stop().catch(() => undefined)
    process.exit(0)
  }
  process.on("SIGTERM", stop)
  process.on("SIGINT", stop)
  process.on("SIGHUP", stop)
  process.on("uncaughtException", (error) => stop(`uncaught ${String(error?.stack ?? error)}`))
  process.on("unhandledRejection", (error) => stop(`unhandled ${String(error?.stack ?? error)}`))
  writeFileSync(
    statePath(run),
    JSON.stringify({ ...state, apiPort, origin, siteOrigin: origins.site, mail: mailFile, ready: true }, null, 2),
  )
  log(`ready ${origin}`)
}
