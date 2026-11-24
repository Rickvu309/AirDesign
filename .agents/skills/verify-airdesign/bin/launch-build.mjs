import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"

const steps = [
  ["--filter", "@airdesign/api...", "run", "build"],
  ["--filter", "web", "build"],
]

export function buildStack(repo, log) {
  for (const filter of steps) {
    try {
      execFileSync("pnpm", filter, { cwd: repo, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 })
    } catch (error) {
      writeFileSync(log, `${String(error.stdout ?? "")}${String(error.stderr ?? "")}`)
      return `build failed: pnpm ${filter.join(" ")}. Log: ${log}`
    }
  }
  return undefined
}
