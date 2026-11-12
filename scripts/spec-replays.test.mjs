import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { replays } from "./spec-replays.mjs"

const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-replays-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))
for (const name of ["kept", "named", "bare"]) fs.mkdirSync(path.join(root, "specs", name), { recursive: true })
fs.mkdirSync(path.join(root, "tests"))
fs.mkdirSync(path.join(root, "apps", "api", "src"), { recursive: true })
fs.writeFileSync(path.join(root, "tests", "spec-replay.test.ts"), 'if (topic.name === "kept") replayKept()\n')
fs.writeFileSync(
  path.join(root, "apps", "api", "src", "named.test.ts"),
  'const graph = await specGraph("named", "Named")\n',
)
fs.writeFileSync(path.join(root, "tests", "bare-view.ts"), 'specGraph("bare", "Bare")\n')

const found = replays(root, {})
const by = Object.fromEntries(found.map((row) => [row.name, row.by]))
if (
  JSON.stringify(by) !==
  JSON.stringify({ bare: [], kept: ["tests/spec-replay.test.ts"], named: ["apps/api/src/named.test.ts"] })
) {
  throw new Error(`replays found ${JSON.stringify(by)}`)
}
const excused = replays(root, { bare: "a reason" }).find((row) => row.name === "bare")
if (excused?.reason !== "a reason") throw new Error("a listed reason was not kept")

console.log("spec-replays tests passed")
