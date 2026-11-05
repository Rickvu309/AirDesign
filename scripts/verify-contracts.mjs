import { spawnSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const output = path.join(process.env.HOME ?? "", "tmp/airdesign-autopilot/P01/checkpoints/W01/probe-report.json")
mkdirSync(path.dirname(output), { recursive: true })
const steps = [
  ["node", "scripts/verify-baseline.mjs"],
  ["npx", "vitest", "run", "tests/contracts/compatibility.test.ts", "tests/lint/source-rules.test.ts"],
  ["node", "--experimental-strip-types", "scripts/probe-compat.ts", "--fixture", "fixtures/pptx/text-span-two-runs", "--output", output],
]
for (const step of steps) {
  const result = spawnSync(step[0], step.slice(1), { cwd: root, stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
