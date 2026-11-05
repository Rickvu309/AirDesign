import { spawnSync } from "node:child_process"

for (const script of ["verify:contracts", "verify:ui", "verify:access"]) {
  const result = spawnSync("npm", ["run", script], { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
