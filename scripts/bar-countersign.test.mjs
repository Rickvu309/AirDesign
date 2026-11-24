import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { countersignBody } from "./countersign.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const head = "c".repeat(40)
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "bar-countersign-"))
process.on("exit", () => fs.rmSync(folder, { recursive: true, force: true }))
fs.writeFileSync(
  path.join(folder, "gh"),
  `#!/usr/bin/env node
const args = process.argv.slice(2).join(" ")
if (args.includes("/comments")) process.stdout.write(process.env.FAKE_COMMENTS)
else if (args.includes("/files")) console.log(JSON.stringify({ name: process.env.FAKE_FILE, status: "removed" }))
else if (args.includes("/compare/")) console.log("f".repeat(40))
else if (args.includes("/contents/")) console.log(args.includes("/pdf.yml") && args.includes("ref=" + "f".repeat(40)) ? "jobs:\\n  pdf:\\n    steps: []\\n" : "{}")
else if (args.includes("-X")) process.exit(0)
else if (args.includes("/pulls/")) console.log(JSON.stringify({ head: "${head}", base: "b", baseRef: "main", files: 1, body: "" }))
`,
  { mode: 0o755 },
)

const barOn = ({ file = ".github/workflows/pdf.yml", comments = [] } = {}) => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("./bar.mjs", import.meta.url)), "Rickvu309/AirDesign", "776"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${folder}:${process.env.PATH}`,
        FAKE_FILE: file,
        FAKE_COMMENTS: comments.map((comment) => `${JSON.stringify(comment)}\n`).join(""),
      },
    },
  )
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}

const unsigned = barOn()
same("a pull request that lowers the bar fails with no countersign", unsigned.status, 1)
same(
  "and says it needs one for its head",
  unsigned.out.includes(`Needs a countersign`) && unsigned.out.includes(head),
  true,
)

const reason = "The PDF assertions moved into the browser spec."
const signed = barOn({
  comments: [{ body: countersignBody({ head, verdict: "right", reason }), association: "OWNER" }],
})
same("a countersign for its head lets it pass", signed.status, 0)
same("and the check prints it", signed.out.includes(`Countersigned ${head}: ${reason}`), true)

const stale = barOn({
  comments: [{ body: countersignBody({ head: "d".repeat(40), verdict: "right", reason }), association: "OWNER" }],
})
same("a countersign for an older head does not", stale.status, 1)

same("a pull request that lowers nothing needs no countersign", barOn({ file: "apps/web/src/gone.ts" }).status, 0)

console.log("bar countersign tests passed")
