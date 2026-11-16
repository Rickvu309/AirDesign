import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { checkLiveCommit, fetched, liveCommitOf, runGit } from "./smoke.mjs"

const askEvery = 20_000
const askFor = 15 * 60_000

export async function deployedCommit({ origin, wanted, read = fetched, git = runGit, wait = sleep, now = Date.now }) {
  const until = now() + askFor
  for (;;) {
    const live = liveCommitOf(await read(`${origin}/version`))
    if (live !== undefined && live !== wanted) git(["fetch", "--quiet", "origin", "main"])
    if (live !== undefined && checkLiveCommit({ git, live, settled: wanted }).ok)
      return { ok: true, line: `production API serves ${live.slice(0, 12)}, which contains ${wanted.slice(0, 12)}` }
    if (now() >= until) return { ok: false, line: `production API still at ${live ?? "no commit"}, wanted ${wanted}` }
    await wait(askEvery)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [origin, wanted] = process.argv.slice(2)
  if (!origin || !/^[0-9a-f]{40}$/.test(wanted ?? "")) {
    console.log("usage: node scripts/production-commit.mjs <api origin> <40-character commit>")
    process.exit(1)
  }
  const result = await deployedCommit({ origin: origin.replace(/\/+$/, ""), wanted })
  console.log(result.line)
  process.exit(result.ok ? 0 : 1)
}
