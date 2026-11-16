#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { expect } from "@playwright/test"
import { serve } from "./serve.mjs"
import { browserCookies } from "./browser-cookies.mjs"
import { designContext, openBrowser, settle } from "./browser.mjs"
import { loadLine } from "./load.mjs"
import { builtSite, fakeOrigins } from "./site.mjs"
import { usage } from "./usage.mjs"

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repo = process.env.VERIFY_AIRDESIGN_REPO
  ? path.resolve(process.env.VERIFY_AIRDESIGN_REPO)
  : execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: skill, encoding: "utf8" }).trim()
const evidenceRoot = path.join(os.homedir(), "tmp", "verify-airdesign")
const scratchRoot = path.join(os.homedir(), "tmp", "verify-airdesign-scratch")
const webDist = path.join(repo, "apps/web/dist")
const apiDist = path.join(repo, "apps/api/dist")
const catalogDist = path.join(repo, "packages/catalog/dist/index.js")

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

function airaPath(run) {
  return path.join(scratchDir(run), "aira.json")
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
  const site = builtSite(repo)
  const log = path.join(scratchDir(run), "stack.log")
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve", run], {
    cwd: repo,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env, VERIFY_AIRDESIGN_LOG: log, VERIFY_AIRDESIGN_SITE: site.dist },
  })
  child.unref()
  for (let waited = 0; waited < 120_000; waited += 500) {
    if (existsSync(statePath(run))) {
      const state = readState(run)
      if (state.ready) {
        proof(
          run,
          `# verify-airdesign run ${run}\n\n- commit ${state.commit}\n- origin ${state.origin}\n- site origin ${state.siteOrigin}, build ${site.built ? "made" : "reused"} at ${site.dist}\n- launched at ${loadLine()}`,
        )
        process.stdout.write(
          `${JSON.stringify({ run, origin: state.origin, siteOrigin: state.siteOrigin, evidence: evidenceDir(run), pid: state.pid })}\n`,
        )
        return
      }
    }
    if (!alive(child.pid)) fail(`stack exited before ready. Log: ${log}`)
    await pause(500)
  }
  fail(`stack not ready after 120 s. Log: ${log}. Run: verify-airdesign stop ${run}`)
}

function answerOf(type, text) {
  const rows = text.split("\n").filter((line) => line.trim() !== "")
  if (type.includes("ndjson")) return { lines: rows.map((line) => JSON.parse(line)) }
  const data = rows.flatMap((line) => (line.startsWith("data: ") ? [JSON.parse(line.slice(6))] : []))
  if (type.includes("event-stream")) return { events: data }
  return text.length === 0 ? {} : JSON.parse(text)
}

async function call(origin, method, pathname, body, cookie, headers = {}) {
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: { "content-type": "application/json", ...headers, ...(cookie === undefined ? {} : { cookie }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await response.text()
  let json
  try {
    json = answerOf(response.headers.get("content-type") ?? "", text)
  } catch {
    json = { text: text.slice(0, 200) }
  }
  const cookies = response.headers.getSetCookie().map((header) => header.split(";")[0])
  return { status: response.status, json, cookie: cookies[0], cookies }
}

async function catalog(state) {
  const root = state?.repo ?? repo
  return import(pathToFileURL(path.join(root, "packages/catalog/dist/index.js")).href)
}

async function doctor(run) {
  const state = readState(run)
  const { deckRoutes } = await catalog(state)
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
  const gone = checks.serveOwned
    ? {}
    : {
        next: `the stack is gone; its last lines are in ${path.join(scratchDir(run), "stack.log")}. Run stop ${run}, then launch again.`,
      }
  process.stdout.write(`${JSON.stringify({ ok, run, origin: state.origin, checks, load: loadLine(), ...gone })}\n`)
  if (!ok) process.exit(1)
}

export function mailsIn(text) {
  return text
    .slice(0, text.lastIndexOf("\n") + 1)
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line))
}

async function signIn(state, email = `verify${randomBytes(4).toString("hex")}@example.com`) {
  const { signInRoutes } = await catalog(state)
  const asked = await call(state.origin, signInRoutes.email.method, signInRoutes.email.path, { email })
  if (asked.status !== 202) throw new Error(`sign-in email answered ${String(asked.status)}`)
  const mails = mailsIn(readFileSync(state.mail, "utf8"))
  const { readSignInMail } = await import(pathToFileURL(path.join(apiDist, "sign-in-mail.js")).href)
  const { code } = readSignInMail(mails.filter((mail) => mail.to === email).at(-1)?.text ?? "")
  const signed = await call(state.origin, signInRoutes.code.method, signInRoutes.code.path, { email, code })
  if (signed.status !== 200 || signed.cookie === undefined)
    throw new Error(`sign-in code answered ${String(signed.status)}`)
  return { email, cookie: signed.cookie, cookies: signed.cookies }
}

async function apiCall(run, name, bodyText, cookie) {
  const state = readState(run)
  const { deckRoutes } = await catalog(state)
  const route = deckRoutes[name]
  if (route === undefined) fail(`unknown deck route ${name}; one of ${Object.keys(deckRoutes).join(", ")}`)
  const answer = await call(state.origin, "POST", route.path, JSON.parse(bodyText ?? "{}"), cookie)
  const file = path.join(evidenceDir(run), `api-${name}-${String(Date.now())}.json`)
  writeFileSync(file, JSON.stringify({ path: route.path, status: answer.status, json: answer.json }, null, 2))
  process.stdout.write(`${JSON.stringify({ status: answer.status, file })}\n`)
}

export const productionHosts = /^https:\/\/([a-z0-9-]+\.)*airdesign\.app\//

export function productionStandIn(url) {
  const shown = url.replace(/[<>&"]/g, "")
  return `<!doctype html><title>Production stand-in</title><h1>Production stand-in</h1><p data-production-url="${shown}">${shown}</p>`
}

export async function journeyKit({ run, name, page, context }) {
  const state = readState(run)
  const { deckRoutes, signInRoutes, accountRoutes, oauthRoutes, airaRoutes, mcpRoutes, countryHeader } =
    await catalog(state)
  const out = path.join(evidenceDir(run), `${name}-${String(Date.now())}`)
  mkdirSync(out, { recursive: true })
  await context.route(productionHosts, (route) =>
    route.fulfill({ contentType: "text/html", body: productionStandIn(route.request().url()) }),
  )
  let step = 0
  const kit = {
    repo,
    expect,
    origin: state.origin,
    siteOrigin: state.siteOrigin,
    page,
    context,
    deckRoutes,
    signInRoutes,
    accountRoutes,
    oauthRoutes,
    airaRoutes,
    mcpRoutes,
    countryHeader,
    aira(scripts) {
      writeFileSync(airaPath(run), JSON.stringify({ at: Date.now(), scripts }))
    },
    mail(to) {
      const mails = mailsIn(readFileSync(state.mail, "utf8")).filter((mail) => mail.to === to)
      const last = mails.at(-1)
      if (last !== undefined) writeFileSync(path.join(out, "mail.json"), JSON.stringify(last, null, 2))
      return last
    },
    async useSite() {
      await context.route(
        (url) => url.origin === "https://airdesign.app" && url.pathname === "/sign-in",
        (route) => {
          const asked = new URL(route.request().url())
          route.fulfill({ status: 302, headers: { location: `${state.siteOrigin}/sign-in${asked.search}` } })
        },
      )
    },
    async mailParts(to) {
      const { readSignInMail } = await import(pathToFileURL(path.join(apiDist, "sign-in-mail.js")).href)
      const sent = kit.mail(to)
      if (sent === undefined) throw new Error(`no mail was sent to ${to}`)
      const { code, link } = readSignInMail(sent.text)
      return { sent, code, link: link.replace(fakeOrigins.app, state.origin) }
    },
    async signIn(again) {
      const { email, cookie, cookies } = await signIn(state, again)
      await context.addCookies(browserCookies(cookies))
      return { email, cookie }
    },
    async post(route, body, cookie, headers) {
      const answer = await call(state.origin, "POST", route.path, body, cookie, headers)
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
      await settle(page)
      await page.screenshot({ path: `${stem}.png`, animations: "disabled" })
      writeFileSync(`${stem}.aria.txt`, await page.locator("body").ariaSnapshot())
      return stem
    },
    note(line) {
      proof(run, `- ${name}: ${line}`)
    },
  }
  return { kit, out }
}

export function journeyFile(name) {
  return name.endsWith(".mjs") ? path.resolve(name) : path.join(skill, "journeys", `${name}.mjs`)
}

export function journeyName(name) {
  return path.basename(name, ".mjs")
}

export function originOf(run) {
  return readState(run).origin
}

export function recordJourney(run, name, passed, out) {
  proof(run, `- ${name}: ${passed ? "PASSED" : "FAILED"} at ${loadLine()}, artifacts ${out}`)
}

async function journey(run, given) {
  const state = readState(run)
  const file = journeyFile(given)
  const name = journeyName(given)
  if (!existsSync(file)) fail(`no journey ${given}: ${file} is missing`)
  const browser = await openBrowser()
  const context = await browser.newContext({ baseURL: state.origin, ...designContext })
  const page = await context.newPage()
  const { kit, out } = await journeyKit({ run, name, page, context })
  const { default: drive } = await import(pathToFileURL(file).href)
  let passed = false
  try {
    await drive(kit)
    passed = true
  } catch (error) {
    await kit.capture("failure").catch(() => undefined)
    writeFileSync(path.join(out, "failure.txt"), `${String(error?.stack ?? error)}\n`)
    proof(
      run,
      `- ${name}: FAILED ${String(error?.message ?? error).split("\n")[0]}; whole error in ${path.join(out, "failure.txt")}`,
    )
  } finally {
    await browser.close()
  }
  recordJourney(run, name, passed, out)
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
  const stackLog = path.join(scratchDir(run), "stack.log")
  if (existsSync(stackLog) && existsSync(evidenceDir(run)))
    copyFileSync(stackLog, path.join(evidenceDir(run), "stack.log"))
  rmSync(scratchDir(run), { recursive: true, force: true })
  if (existsSync(evidenceDir(run))) proof(run, `- stopped: ${stopped.join(", ") || "nothing was running"}`)
  process.stdout.write(
    `${JSON.stringify({ run, stopped, left, evidence: evidenceDir(run), evidenceKept: existsSync(evidenceDir(run)) })}\n`,
  )
}

const invoked = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
const [command, ...rest] = invoked ? process.argv.slice(2) : ["library"]
const flag = (name) => {
  const at = rest.indexOf(name)
  return at === -1 ? undefined : rest[at + 1]
}

try {
  if (["look", "compare", "sheet", "states"].includes(command)) {
    const { designCommand } = await import("./design.mjs")
    process.stdout.write(
      `${JSON.stringify(await designCommand(command, rest, { repo, readState, evidenceDir, journeyKit }))}\n`,
    )
  } else if (["before-after", "annotate", "publish"].includes(command)) {
    const { proofCommand } = await import("./proof.mjs")
    process.stdout.write(
      `${JSON.stringify(await proofCommand(command, rest, { repo, readState, evidenceDir, journeyKit }))}\n`,
    )
  } else if (command === "suites") {
    const { suitesCommand } = await import("./suites.mjs")
    process.stdout.write(`${JSON.stringify(await suitesCommand(rest, { repo, evidenceRoot }))}\n`)
  } else if (command === "prove") {
    const { proveCommand } = await import("./prove.mjs")
    process.stdout.write(`${JSON.stringify(await proveCommand(rest, { repo, evidenceRoot }))}\n`)
  } else if (command === "comment") {
    const { comment: postComment } = await import("./comment.mjs")
    process.stdout.write(`${JSON.stringify(await postComment({ pr: rest[0], file: rest[1] }))}\n`)
  } else if (command === "launch") await launch(rest)
  else if (command === "serve")
    await serve(rest[0], {
      repo,
      apiDist,
      webDist,
      siteDist: process.env.VERIFY_AIRDESIGN_SITE,
      catalogDist,
      scratchDir,
      statePath,
      airaPath,
      head,
    })
  else if (command === "doctor") await doctor(rest[0])
  else if (command === "sign-in") {
    const { email, cookie } = await signIn(readState(rest[0]), flag("--email"))
    process.stdout.write(`${JSON.stringify({ email, cookie })}\n`)
  } else if (command === "api") await apiCall(rest[0], rest[1], rest[2], flag("--cookie"))
  else if (command === "journey") await journey(rest[0], rest[1])
  else if (command === "stop") await stop(rest[0])
  else if (command !== "library") {
    process.stdout.write(usage)
  }
} catch (error) {
  fail(`verify-airdesign ${command}: ${String(error.message ?? error)}`)
}
