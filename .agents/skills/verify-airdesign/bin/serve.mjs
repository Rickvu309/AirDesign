import { appendFileSync, createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import { request as httpRequest, createServer } from "node:http"
import path from "node:path"
import { buildApi } from "./launch-build.mjs"
import { runPostgres, writeAtomic } from "./leftover-runs.mjs"
import { randomBytes } from "node:crypto"
import { fontShelf, shelfFolder, shelveFonts } from "../../../../scripts/font-shelf.mjs"
import { countedTransport } from "./aira-counts.mjs"
import { scriptedAira } from "./scripted-aira.mjs"
import { verifyImages } from "./verify-images.mjs"
import { fakeOrigins, moveLocation, siteFile, withAppOrigin } from "./site.mjs"
import { pathToFileURL } from "node:url"
import { packageBuild, packageEntry } from "../../../../scripts/package-build.mjs"

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
    if (res.destroyed) return
    res.writeHead(502)
    res.end()
  })
  res.once("close", () => {
    if (!res.writableEnded) outgoing.destroy()
  })
  req.pipe(outgoing)
}

function servedFile(wanted, webDist) {
  for (const each of [wanted, `${wanted}.html`])
    if (each.startsWith(webDist) && existsSync(each) && statSync(each).isFile()) return each
  return path.join(webDist, "index.html")
}

function serveFile(pathname, res, webDist) {
  const file = servedFile(path.join(webDist, path.normalize(decodeURIComponent(pathname))), webDist)
  res.writeHead(200, {
    "content-type": types[path.extname(file)] ?? "application/octet-stream",
    "access-control-allow-origin": "*",
  })
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

async function serveSignInPage(signInWorker, req, res, siteDist, appOrigin) {
  const url = new URL(req.url ?? "/", "http://site")
  let page = false
  const answer = await signInWorker.fetch(
    new Request(url, { method: req.method, headers: { cookie: req.headers.cookie ?? "" } }),
    {
      APP_ORIGIN: appOrigin,
      ASSETS: {
        fetch: () => {
          page = true
          return Promise.resolve(new Response())
        },
      },
    },
  )
  if (page) serveSite(url.pathname, res, siteDist, appOrigin)
  else res.writeHead(answer.status, Object.fromEntries(answer.headers)).end()
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

function closeServer(server) {
  server.close()
  server.closeAllConnections()
}

export async function serve(run, parts) {
  const log = (line) => appendFileSync(process.env.VERIFY_AIRDESIGN_LOG ?? "/dev/null", `${line}\n`)
  const open = []
  const startup = new AbortController()
  let stopping = false
  const stop = async (why, status = 0) => {
    if (stopping) return
    stopping = true
    startup.abort(new Error(String(why)))
    try {
      log(`stopping: ${String(why)} at ${new Date().toISOString()}`)
    } catch (error) {
      if (error.code !== "ENOENT") process.stderr.write(`${String(error)}\n`)
    }
    for (const close of open.toReversed()) {
      try {
        await close()
      } catch (error) {
        process.stderr.write(`${String(error)}\n`)
      }
    }
    process.exit(status)
  }
  for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) process.on(signal, () => stop(signal))
  process.on("uncaughtException", (error) => stop(`uncaught ${String(error?.stack ?? error)}`, 1))
  process.on("unhandledRejection", (error) => stop(`unhandled ${String(error?.stack ?? error)}`, 1))
  try {
    await startStack(run, parts, open, log, startup.signal)
  } catch (error) {
    await stop(`startup failed ${String(error?.stack ?? error)}`, 1)
  }
}

async function startStack(
  run,
  { repo, toolRepo, apiDist, webDist, siteDist, scratchDir, statePath, airaPath, head, choice },
  open,
  log,
  signal,
) {
  const { runBootstrap, runSetup } = await packageBuild(repo, "@airdesign/api", "platform/provision.js")
  const { openPool } = await packageBuild(repo, "@airdesign/api", "platform/pool.js")
  const { DeckListen } = await packageBuild(repo, "@airdesign/api", "platform/listen.js")
  const { createApi, routes } = await packageBuild(repo, "@airdesign/api", "server.js")
  const { LocalOriginalStore } = await packageBuild(repo, "@airdesign/api", "platform/local-original-store.js")
  const { FontSource } = await packageBuild(repo, "@airdesign/api", "platform/font-source.js")
  const fonts = new FontSource(fontShelf(shelfFolder))
  await shelveFonts(fonts)
  const { Replay } = await packageBuild(repo, "@airdesign/api", "testing/aira-replay.js")
  const { airaModel, airaEffort } = await packageBuild(repo, "@airdesign/api", "aira/aira.js")
  const { anthropicTransport } = await packageBuild(repo, "@airdesign/api", "aira/anthropic-transport.js")
  const imageNet = existsSync(path.join(apiDist, "platform/image-fetch.js"))
    ? verifyImages(repo, (await packageBuild(repo, "@airdesign/api", "platform/image-fetch.js")).nodeNet)
    : undefined
  const startCluster = await clusterStarter(repo, toolRepo)
  signal.throwIfAborted()
  const postgres = runPostgres(scratchDir(run))
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
    postgres,
    ready: false,
  }
  const saveState = (value) => writeAtomic(statePath(run), JSON.stringify(value, null, 2))
  saveState(state)
  const starting = startCluster({ dir: path.dirname(postgres.dataDir), signal })
  open.push(async () => {
    const cluster = await starting.catch(() => undefined)
    await cluster?.stop()
  })
  const cluster = await starting
  signal.throwIfAborted()
  const role = (name) => `postgres://${name}:${randomBytes(18).toString("hex")}@127.0.0.1:${String(cluster.port)}/api`
  const environment = {
    ADMIN_DATABASE_URL: cluster.admin,
    SESSION_DATABASE_URL: role("session"),
    DECK_DATABASE_URL: role("deck"),
    LISTEN_DATABASE_URL: role("listen"),
    MIGRATOR_DATABASE_URL: role("migrator"),
  }
  const write = (_, line) => log(line)
  if ((await runBootstrap(environment, write)) !== 0) throw new Error("bootstrap")
  signal.throwIfAborted()
  if ((await runSetup(environment, write)) !== 0) throw new Error("setup")
  signal.throwIfAborted()
  const session = openPool(environment.SESSION_DATABASE_URL, "verify-session")
  open.push(() => session.end())
  const deck = openPool(environment.DECK_DATABASE_URL, "verify-deck")
  open.push(() => deck.end())
  const listen = new DeckListen(environment.LISTEN_DATABASE_URL)
  open.push(() => listen.close())
  const mailFile = path.join(scratchDir(run), "mail.jsonl")
  const airaCounts = path.join(scratchDir(run), "aira-counts.jsonl")
  const aira =
    choice.keyEnv === undefined
      ? scriptedAira({ Replay, repo, file: airaPath(run), log })
      : {
          on: true,
          key: process.env[choice.keyEnv],
          secret: randomBytes(32).toString("hex"),
          transport: anthropicTransport(),
          log,
        }
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
    fonts,
    ...(imageNet === undefined ? {} : { imageNet }),
    send: async (mail) => {
      appendFileSync(mailFile, `${JSON.stringify(mail)}\n`)
    },
    aira: {
      ...aira,
      transport: countedTransport(aira.transport, (counts) =>
        appendFileSync(airaCounts, `${JSON.stringify({ at: Date.now(), ...counts })}\n`),
      ),
      model: state.aira.model,
      effort: state.aira.effort,
    },
  })
  open.push(() => closeServer(api))
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve))
  const apiPort = api.address().port
  const apiPaths = new Set(routes.map((route) => route.path))
  const { countryHeader, signInPaths, signOutPaths } = await packageBuild(repo, "@airdesign/catalog")
  const sitePaths = new Set([...signInPaths, ...signOutPaths])
  const signInWorker = await import(pathToFileURL(path.join(repo, "apps/site/worker/sign-in-forward.ts")).href)
  const signInPages = new Set(signInWorker.signInPagePaths ?? [])
  const origins = { app: "", site: "" }
  const site = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", "http://front").pathname
    if (sitePaths.has(pathname)) forward(req, res, apiPort, countryHeader, origins)
    else if (signInPages.has(pathname)) void serveSignInPage(signInWorker.default, req, res, siteDist, origins.app)
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
  open.push(() => closeServer(site))
  open.push(() => closeServer(front))
  await new Promise((resolve) => site.listen(0, "127.0.0.1", resolve))
  await new Promise((resolve) => front.listen(0, "127.0.0.1", resolve))
  origins.site = `http://127.0.0.1:${String(site.address().port)}`
  const origin = `http://127.0.0.1:${String(front.address().port)}`
  origins.app = origin
  signal.throwIfAborted()
  saveState({ ...state, apiPort, origin, siteOrigin: origins.site, mail: mailFile, airaCounts, ready: true })
  log(`ready ${origin}`)
}

async function clusterStarter(repo, toolRepo) {
  const fromRepo = await packageBuild(repo, "@airdesign/api", "testing/postgres-setup.js")
  if (fromRepo.startOwnedEmptyCluster !== undefined) return fromRepo.startOwnedEmptyCluster
  if (repo === toolRepo) throw new Error("rebuild the API to start a run-owned Postgres cluster")
  const entry = path.join(path.dirname(packageEntry(toolRepo, "@airdesign/api")), "testing/postgres-setup.js")
  const url = pathToFileURL(entry)
  if (existsSync(entry)) {
    const { startOwnedEmptyCluster } = await import(url.href)
    if (startOwnedEmptyCluster !== undefined) return startOwnedEmptyCluster
  }
  buildApi(toolRepo)
  url.searchParams.set("rebuilt", "1")
  const { startOwnedEmptyCluster } = await import(url.href)
  if (startOwnedEmptyCluster === undefined) throw new Error("rebuild the API to start a run-owned Postgres cluster")
  return startOwnedEmptyCluster
}
