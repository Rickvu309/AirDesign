import { spawnSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

export const toolingTests = (folder) => [
  "tooling/oxlint-plugin-airdesign/run-tests.js",
  ...readdirSync(path.join(folder, "scripts"))
    .filter((name) => name.endsWith(".test.mjs"))
    .sort()
    .map((name) => `scripts/${name}`),
]

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const test of toolingTests(root)) {
    const ran = spawnSync(process.execPath, [test], { cwd: root, stdio: "inherit" })
    if (ran.status !== 0) {
      console.error(`fail ${test}`)
      process.exit(ran.status ?? 1)
    }
  }
}
