import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { freshBrowserExport } from "./browser-export.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-export-"))
const file = path.join(dir, "exported-deck.pptx")
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }))

const planted = fs.readFileSync(path.join(root, "scripts/pptx-fixtures/text.pptx"))
fs.writeFileSync(file, planted)
let during = "unread"
const fresh = Buffer.from("fresh-export")
const replaced = await freshBrowserExport({
  file,
  run: async () => {
    during = fs.existsSync(file) ? "present" : "gone"
    fs.writeFileSync(file, fresh)
  },
})
if (during !== "gone") throw new Error("V5 judged the planted text.pptx")
if (!replaced.ok) throw new Error("V5 rejected the replacement export")
if (!fs.readFileSync(file).equals(fresh)) throw new Error("V5 kept the planted text.pptx")

fs.writeFileSync(file, Buffer.from("old good export"))
let seen = "unread"
const missing = await freshBrowserExport({
  file,
  run: async () => {
    seen = fs.existsSync(file) ? "present" : "gone"
  },
})
if (seen !== "gone") throw new Error("V2 left the old export in place")
if (missing.ok) throw new Error("V2 passed with no export")
if (missing.line === undefined || !missing.line.includes("wrote no tests/browser/exported-deck.pptx")) {
  throw new Error(missing.line ?? "V2 passed with no export")
}
if (fs.existsSync(file)) throw new Error("V2 kept the old export")

fs.writeFileSync(file, Buffer.from("old good export"))
const failedSpec = await freshBrowserExport({
  file,
  run: async () => {
    fs.writeFileSync(file, Buffer.from("partial"))
    throw new Error("spec failed")
  },
})
if (failedSpec.ok) throw new Error("a failed spec passed")
if (failedSpec.line === undefined || !failedSpec.line.includes("browser export spec failed")) {
  throw new Error(failedSpec.line ?? "a failed spec passed")
}

const silentSpec = await freshBrowserExport({
  file,
  run: async () => {
    fs.writeFileSync(file, Buffer.from("written before the failure"))
    throw new Error("")
  },
})
if (silentSpec.ok) throw new Error("a spec that failed with no message passed")
if (!silentSpec.line.includes("browser export spec failed")) throw new Error(silentSpec.line)

console.log("browser export tests passed")
