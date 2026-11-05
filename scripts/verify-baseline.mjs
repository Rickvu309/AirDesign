import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"

const lockfile = readFileSync(new URL("../package-lock.json", import.meta.url))
const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
const manifest = {
  schemaVersion: 1,
  head,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  lockfileSha256: createHash("sha256").update(lockfile).digest("hex"),
}
process.stdout.write(`${JSON.stringify(manifest)}\n`)
if (!/^[0-9a-f]{40}$/.test(head)) {
  process.exit(1)
}
