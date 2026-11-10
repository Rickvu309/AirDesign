import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { references, workspaceRoot } from "./reference-order.mjs"

const root = workspaceRoot(path.dirname(fileURLToPath(import.meta.url)))
const projects = references(root)
if (projects.length === 0) {
  console.error("no composite project under apps/ or packages/")
  process.exit(1)
}
const tsc = path.join(root, "node_modules", ".bin", "tsc")
const built = spawnSync(tsc, ["-b", ...projects, ...process.argv.slice(2)], { cwd: root, stdio: "inherit" })
process.exit(built.status ?? 1)
