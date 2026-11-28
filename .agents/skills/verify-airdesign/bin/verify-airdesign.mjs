#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { airaArgs, airaChoice, airaFlags } from "./aira-choice.mjs"
import { serve } from "./serve.mjs"
import { browserCookies } from "./browser-cookies.mjs"
import {
  alive,
  foreignRun,
  newRun,
  ownerOf,
  ownsServe,
  removeLeftoverRuns,
  runsOf,
  sameWorktree,
  writeOwner,
} from "./leftover-runs.mjs"
import { buildStack } from "./launch-build.mjs"
import { listenForInterrupt } from "./interruptions.mjs"
import { rollbackLaunch } from "./launch-rollback.mjs"
import { postgresPid, stopStack } from "./stop-stack.mjs"
import { loadLine } from "./load.mjs"
import { call } from "./api-call.mjs"
import { builtSite, fakeOrigins } from "./site.mjs"
import { replyRoutes } from "./reply-routes.mjs"
import { usage } from "./usage.mjs"
import { packageBuild, packageEntry } from "../../../../scripts/package-build.mjs"

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const toolRepo = realpathSync(path.resolve(skill, "../../.."))
const repo = realpathSync(
  process.env.VERIFY_AIRDESIGN_REPO
    ? path.resolve(process.env.VERIFY_AIRDESIGN_REPO)
    : execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: skill, encoding: "utf8" }).trim(),
)
const evidenceRoot = path.join(os.homedir(), "tmp", "verify-airdesign")
const scratchRoot = path.join(os.homedir(), "tmp", "verify-airdesign-scratch")
const webDist = path.join(repo, "apps/web/dist")
const apiDist = path.join(repo, "apps/api/dist")
const catalogDist = packageEntry(repo, "@airdesign/catalog")

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
  const leftover = await removeLeftoverRuns({ scratchRoot, repo, stop: stopRun })
  if (leftover.stopped.length + leftover.removed.length > 0) process.stderr.write(`${JSON.stringify({ leftover })}\n`)
  const run = newRun()
  mkdirSync(evidenceDir(run), { recursive: true })
  mkdirSync(scratchDir(run), { recursive: true })
  writeOwner(scratchDir(run), repo)
  const stackLog = path.join(evidenceDir(run), "stack.log")
  const interrupted = new AbortController()
  const unlisten = listenForInterrupt((signal) => interrupted.abort(new Error(`launch interrupted by ${signal}`)))
  let child
  try {
    if (!args.includes("--no-build")) {
      const failed = buildStack(repo, path.join(evidenceDir(run), "build.log"))
      if (failed !== undefined) throw new Error(failed)
    }
    for (const built of [webDist, apiDist, catalogDist]) {
      if (!existsSync(built)) throw new Error(`missing build output ${built}; run launch without --no-build`)
    }
    const { airaEfforts } = await packageBuild(repo, "@airdesign/api", "aira/aira.js")
    const chosen = airaChoice(args, process.env, airaEfforts)
    if (!chosen.ok) throw new Error(chosen.message)
    const site = builtSite(repo)
    interrupted.signal.throwIfAborted()
    const log = path.join(scratchDir(run), "stack.log")
    child = spawn(process.execPath, [fileURLToPath(import.meta.url), "serve", run, ...airaArgs(chosen.choice)], {
      cwd: repo,
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      env: { ...process.env, VERIFY_AIRDESIGN_LOG: log, VERIFY_AIRDESIGN_SITE: site.dist },
    })
    for (let waited = 0; waited < 120_000; waited += 500) {
      interrupted.signal.throwIfAborted()
      if (existsSync(statePath(run))) {
        const state = readState(run)
        if (state.ready) {
          child.unref()
          proof(
            run,
            `# verify-airdesign run ${run}\n\n- commit ${state.commit}\n- origin ${state.origin}\n- site origin ${state.siteOrigin}, build ${site.built ? "made" : "reused"} at ${site.dist}\n- Aira: ${state.aira.streams} streams, ${state.aira.model} at ${state.aira.effort} effort\n- launched at ${loadLine()}`,
          )
          process.stdout.write(
            `${JSON.stringify({ run, origin: state.origin, siteOrigin: state.siteOrigin, aira: state.aira, evidence: evidenceDir(run), pid: state.pid })}\n`,
          )
          return
        }
      }
      if (!alive(child.pid)) throw new Error(`stack exited before ready. Log: ${stackLog}`)
      await pause(500)
    }
    throw new Error(`stack not ready after 120 s. Log: ${stackLog}`)
  } catch (error) {
    await rollbackLaunch(child, () => teardownRun(run), scratchDir(run), stackLog)
    throw error
  } finally {
    unlisten()
  }
}

async function catalog(state) {
  const root = state?.repo ?? repo
  return packageBuild(root, "@airdesign/catalog")
}

async function doctor(run) {
  const state = readState(run)
  const { deckRoutes } = await catalog(state)
  const checks = {
    serveOwned: ownsServe(state),
    postgresOwned: postgresPid(state, scratchDir(run)) !== undefined,
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
  const { signInRoutes, accountRoutes } = await catalog(state)
  const asked = await call(state.origin, signInRoutes.email.method, signInRoutes.email.path, { email })
  if (asked.status !== 202) throw new Error(`sign-in email answered ${String(asked.status)}`)
  const mails = mailsIn(readFileSync(state.mail, "utf8"))
  const { readSignInMail } = await packageBuild(repo, "@airdesign/api", "account/testing/read-sign-in-mail.js")
  const { code } = readSignInMail(mails.filter((mail) => mail.to === email).at(-1)?.text ?? "")
  const signed = await call(state.origin, signInRoutes.code.method, signInRoutes.code.path, { email, code })
  if (signed.status !== 200 || signed.cookie === undefined)
    throw new Error(`sign-in code answered ${String(signed.status)}`)
  const profile =
    accountRoutes.profile === undefined
      ? undefined
      : await call(state.origin, "POST", accountRoutes.profile.path, {}, signed.cookie)
  if (profile?.status === 200 && profile.json.account.name === null) {
    const named = await call(state.origin, "POST", accountRoutes.name.path, { name: "Verify" }, signed.cookie)
    if (named.status !== 200) throw new Error(`name answered ${String(named.status)}`)
  }
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
  const { expect } = await import("@playwright/test")
  const { settle } = await import("./browser.mjs")
  const {
    deckRoutes,
    doomRoutes,
    signInRoutes,
    accountRoutes,
    oauthRoutes,
    airaRoutes,
    mcpRoutes,
    fontRoutes,
    countryHeader,
  } = await catalog(state)
  const out = path.join(evidenceDir(run), `${name}-${String(Date.now())}`)
  mkdirSync(out, { recursive: true })
  await context.route(productionHosts, (route) =>
    route.fulfill({ contentType: "text/html", body: productionStandIn(route.request().url()) }),
  )
  const { releaseHeldReplies, ...replies } = replyRoutes(page, state.origin, state.siteOrigin)
  let step = 0
  const kit = {
    repo,
    expect,
    origin: state.origin,
    siteOrigin: state.siteOrigin,
    airaCounts: state.airaCounts,
    page,
    context,
    deckRoutes,
    doomRoutes,
    signInRoutes,
    accountRoutes,
    oauthRoutes,
    airaRoutes,
    mcpRoutes,
    fontRoutes,
    ...replies,
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
      const { readSignInMail } = await packageBuild(repo, "@airdesign/api", "account/testing/read-sign-in-mail.js")
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
  async function runJourney(drive) {
    try {
      await drive(kit)
    } finally {
      await releaseHeldReplies()
    }
  }
  return { kit, out, runJourney }
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
  const { designContext, openBrowser } = await import("./browser.mjs")
  const browser = await openBrowser()
  const context = await browser.newContext({ baseURL: state.origin, ...designContext })
  const page = await context.newPage()
  const { kit, out, runJourney } = await journeyKit({ run, name, page, context })
  const { default: drive } = await import(pathToFileURL(file).href)
  let passed = false
  try {
    await runJourney(drive)
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

const teardownRun = (run) => stopStack({ run, scratch: scratchDir(run), evidence: evidenceDir(run) })

async function stopRun(run) {
  const stateFile = statePath(run)
  if (!existsSync(stateFile)) return { run, stopped: [], note: "no state; nothing of this run is running" }
  let state
  try {
    state = JSON.parse(readFileSync(stateFile, "utf8"))
  } catch {
    fail(`run ${run} has a state that cannot be read, so its owner cannot be checked; nothing was stopped`)
  }
  const owner = ownerOf(scratchDir(run)) ?? state.repo
  if (!sameWorktree(owner, repo))
    fail(`run ${run} is not owned by this worktree (${repo}); only its own worktree stops it`)
  return teardownRun(run)
}

async function stop(run) {
  const runs = run === undefined ? runsOf({ scratchRoot, repo }) : [run]
  for (const each of runs) {
    const owner = foreignRun({ scratchRoot, repo, run: each })
    if (owner !== undefined)
      fail(`run ${each} was started in ${owner}, not in this worktree (${repo}); only its own worktree stops it`)
  }
  for (const each of runs) {
    const result = await stopRun(each)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.left?.length > 0) process.exitCode = 1
  }
  if (runs.length === 0)
    process.stdout.write(`${JSON.stringify({ stopped: [], note: "no run of this worktree is running" })}\n`)
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
  } else if (command === "bench") {
    const { benchCommand } = await import("./bench.mjs")
    process.stdout.write(`${JSON.stringify(await benchCommand(rest, { repo, readState, evidenceDir, journeyKit }))}\n`)
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
      toolRepo,
      apiDist,
      webDist,
      siteDist: process.env.VERIFY_AIRDESIGN_SITE,
      scratchDir,
      statePath,
      airaPath,
      head,
      choice: airaFlags(rest.slice(1)),
    })
  else if (command === "doctor") await doctor(rest[0])
  else if (command === "sign-in") {
    const { email, cookie } = await signIn(readState(rest[0]), flag("--email"))
    process.stdout.write(`${JSON.stringify({ email, cookie })}\n`)
  } else if (command === "api") {
    const [run, route, body] = rest
    await apiCall(run, route, body?.startsWith("--") ? undefined : body, flag("--cookie"))
  } else if (command === "journey") await journey(rest[0], rest[1])
  else if (command === "stop") await stop(rest[0])
  else if (command === undefined || command === "-h" || command === "--help") {
    process.stdout.write(usage)
  } else if (command !== "library") {
    process.stderr.write(`unknown command ${command}\n${usage}`)
    process.exitCode = 1
  }
} catch (error) {
  fail(`verify-airdesign ${command}: ${String(error.message ?? error)}`)
}
