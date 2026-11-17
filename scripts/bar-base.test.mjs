import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "bar-base-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
fs.writeFileSync(
  path.join(folder, "gh"),
  `#!/usr/bin/env node
const args = process.argv.slice(2).join(" ")
if (args.includes("/files")) process.exit(0)
if (args.includes("/compare/")) console.log("f".repeat(40))
else if (args.includes("/contents/")) console.log("{}")
else if (args.includes("-X")) process.exit(0)
else if (args.includes("/pulls/")) console.log(JSON.stringify({ head: "h", base: "b", baseRef: process.env.FAKE_BASE, files: 0, body: "" }))
`,
  { mode: 0o755 },
)

const barOnPull = (number, baseRef) => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./bar.mjs", import.meta.url)), "Rickvu309/AirDesign", String(number)],
    { encoding: "utf8", env: { ...process.env, PATH: `${folder}:${process.env.PATH}`, FAKE_BASE: baseRef } },
  )
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

same("bar passes a pull request against main", barOnPull(406, "main").status, 0)
const another = barOnPull(403, "agent-element-tools")
same("bar fails a pull request against another pull request's branch", another.status, 1)
if (!another.out.includes("run pnpm land in its branch; it moves the base to main")) {
  throw new Error(`bar does not name the fix for a base that is not main: ${another.out}`)
}
