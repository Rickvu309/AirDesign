import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { importParse, parsePercent } from "./import-parse.mjs"

assert.equal(parsePercent({ parsed: 4567, markup: 2172 }), 210)
assert.equal(parsePercent({ parsed: 2172, markup: 2172 }), 100)
assert.equal(parsePercent({ parsed: 0, markup: 0 }), 0)

const root = fs.mkdtempSync(path.join(os.tmpdir(), "import-parse-"))
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }))
await assert.rejects(importParse(root), {
  message: "packages/pptx is not built. Run pnpm build, then run this again.",
})

console.log("import parse tests passed")
