import { spawnSync } from "node:child_process"
import { writeSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { fetched, liveCommitOf } from "./smoke.mjs"

const hex = /^[0-9a-f]{40}$/
const history = 100

export const deployBranch = "green"

export const versionOf = {
  site: "https://airdesign.app",
  web: "https://studio.airdesign.app",
  api: "https://api-production-f919c062.up.railway.app",
}

export const versionLabel = {
  site: "site",
  web: "web app",
  api: "production API",
}

export function versionLive(reply) {
  if (reply.status === 0) return { error: "no answer" }
  const commit = liveCommitOf(reply)
  if (typeof commit === "string" && hex.test(commit)) return { live: commit }
  return {}
}

export function latestConclusions(runs) {
  const ci = {}
  for (const run of [...runs].sort((left, right) => right.id - left.id)) {
    if (run.event !== "push" || run.branch !== "main" || run.sha === undefined || ci[run.sha] !== undefined) continue
    ci[run.sha] = run.conclusion ?? "pending"
  }
  return ci
}

const serves = (commits, live, sha) => {
  if (live === sha) return true
  const liveAt = commits.indexOf(live)
  const shaAt = commits.indexOf(sha)
  return liveAt !== -1 && shaAt !== -1 && liveAt < shaAt
}

export function chooseDeploy({ commits, ci, live }) {
  const sha = commits.find((commit) => ci[commit] === "success")
  if (sha === undefined) return { deploy: false, reason: "none" }
  if (typeof live === "string" && serves(commits, live, sha)) return { deploy: false, reason: "served", sha }
  return { deploy: true, sha }
}

export function greenPushArgs(sha) {
  return ["push", "origin", `${sha}:refs/heads/${deployBranch}`]
}

export function pushGreen(git, sha) {
  if (git(greenPushArgs(sha)).status === 0) return { ok: true }
  git(["fetch", "--quiet", "origin", deployBranch])
  if (git(["merge-base", "--is-ancestor", sha, `origin/${deployBranch}`]).status === 0) return { ok: true, ahead: true }
  return { ok: false }
}

const command = (bin, args) => {
  const result = spawnSync(bin, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] })
  return { status: result.status ?? 1, stdout: result.stdout ?? "" }
}

const git = (args) => command("git", args)

const mainCommits = () => {
  if (git(["fetch", "--quiet", "origin", "main"]).status !== 0) return undefined
  const listed = git(["rev-list", "--first-parent", "-n", String(history), "origin/main"])
  if (listed.status !== 0) return undefined
  return listed.stdout
    .trim()
    .split("\n")
    .filter((sha) => hex.test(sha))
}

const pushRuns = (repository) => {
  const answer = command("gh", [
    "api",
    `repos/${repository}/actions/workflows/ci.yml/runs?branch=main&event=push&per_page=100`,
    "--jq",
    "[.workflow_runs[] | {id, sha: .head_sha, conclusion, event, branch: .head_branch}]",
  ])
  if (answer.status !== 0) return undefined
  return JSON.parse(answer.stdout || "[]")
}

const greenCommit = () => {
  if (git(["fetch", "--quiet", "origin", deployBranch]).status !== 0) return undefined
  const parsed = git(["rev-parse", "--verify", "--quiet", `origin/${deployBranch}`])
  const sha = parsed.status === 0 ? parsed.stdout.trim() : ""
  return hex.test(sha) ? sha : undefined
}

const appLive = async (app) => {
  if (app === "api") return { live: greenCommit() }
  const read = versionLive(await fetched(`${versionOf[app]}/version`))
  if (read.error !== undefined) return read
  return { live: read.live }
}

const decide = async (app) => {
  const commits = mainCommits()
  const runs = pushRuns(process.env.GITHUB_REPOSITORY ?? "")
  if (commits === undefined || runs === undefined) return undefined
  const found = await appLive(app)
  if (found.error !== undefined) {
    console.error(`${app} version: ${found.error}`)
    return undefined
  }
  const choice = chooseDeploy({ commits, ci: latestConclusions(runs), live: found.live })
  console.error(choice.deploy ? `deploy ${choice.sha}` : `skip ${choice.reason} ${choice.sha ?? ""}`.trim())
  return choice
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const code = await (async () => {
    if (process.argv.includes("--apply")) {
      const sha = process.env.SHA ?? ""
      if (!hex.test(sha)) {
        console.error("the deploy commit is missing")
        return 1
      }
      return pushGreen(git, sha).ok ? 0 : 1
    }
    const app = process.env.APP ?? ""
    if (versionOf[app] === undefined) {
      console.error("APP must be site, web or api")
      return 1
    }
    const choice = await decide(app)
    if (choice === undefined) return 1
    writeSync(1, `sha=${choice.sha ?? ""}\ndeploy=${choice.deploy ? "true" : "false"}\n`)
    return 0
  })()
  process.exit(code)
}
