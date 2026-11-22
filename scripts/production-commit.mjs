import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { versionLabel, versionOf } from "./deploy-commit.mjs"
import { checkLiveCommit, fetched, liveCommitOf, runGit } from "./smoke.mjs"

const askEvery = 20_000
const askFor = 15 * 60_000
const hex = /^[0-9a-f]{40}$/

const served = (label, live, wanted) => `${label} serves ${live.slice(0, 12)}, which contains ${wanted.slice(0, 12)}`

export async function deployedCommit({
  origin,
  origins,
  wanted,
  read = fetched,
  git = runGit,
  wait = sleep,
  now = Date.now,
}) {
  const targets = origins ?? [{ origin, label: "production API" }]
  const until = now() + askFor
  for (;;) {
    const ready = []
    const waiting = []
    for (const target of targets) {
      const live = liveCommitOf(await read(`${target.origin}/version`))
      if (live !== undefined && live !== wanted) git(["fetch", "--quiet", "origin", "main"])
      if (live !== undefined && checkLiveCommit({ git, live, settled: wanted }).ok)
        ready.push(served(target.label, live, wanted))
      else waiting.push(`${target.label} still at ${live ?? "no commit"}`)
    }
    if (waiting.length === 0) return { ok: true, line: ready.join("; ") }
    if (now() >= until) return { ok: false, line: `${waiting.join("; ")}, wanted ${wanted}` }
    await wait(askEvery)
  }
}

export function parseWait(argv) {
  if (argv.length === 2 && argv[0] && !hex.test(argv[0]) && hex.test(argv[1] ?? "")) {
    return { wanted: argv[1], targets: [{ origin: argv[0].replace(/\/+$/, ""), label: "production API" }] }
  }
  if (argv.length >= 2 && hex.test(argv[0] ?? "") && argv.slice(1).every((name) => versionOf[name] !== undefined)) {
    return {
      wanted: argv[0],
      targets: argv.slice(1).map((name) => ({ origin: versionOf[name], label: versionLabel[name] })),
    }
  }
  return undefined
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const parsed = parseWait(process.argv.slice(2))
  if (parsed === undefined) {
    console.log("usage: node scripts/production-commit.mjs <api origin> <40-character commit>")
    console.log("   or: node scripts/production-commit.mjs <40-character commit> site|web|api ...")
    process.exit(1)
  }
  const result = await deployedCommit({ origins: parsed.targets, wanted: parsed.wanted })
  console.log(result.line)
  process.exit(result.ok ? 0 : 1)
}
