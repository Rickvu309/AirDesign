import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const api = ["--filter", "@airdesign/api...", "run", "build"]

function build(repo, filter) {
  execFileSync("pnpm", filter, { cwd: repo, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 })
}

export const buildApi = (repo) => build(repo, api)

export function buildStack(repo, log) {
  for (const filter of [api, ["--filter", "web", "build"]]) {
    try {
      build(repo, filter)
    } catch (error) {
      writeFileSync(log, `${String(error.stdout ?? "")}${String(error.stderr ?? "")}`)
      return `build failed: pnpm ${filter.join(" ")}. Log: ${log}`
    }
  }
  return undefined
}
