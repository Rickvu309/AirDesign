import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { guarded } from "./bar.mjs"
import { authored, tokenLimit, tokensOf } from "./file-size.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const agents = read("AGENTS.md")
const table = read("CHECKS.md")

same("AGENTS.md names the file that holds the rule table", agents.includes("`CHECKS.md`"), true)
same("AGENTS.md no longer holds the rule table", agents.includes("| Rule | Enforced by |"), false)
same("the rule table sits in CHECKS.md", table.includes("| Rule | Enforced by |"), true)
same("the file-size check covers CHECKS.md", authored("CHECKS.md"), true)
same("a change to CHECKS.md is listed for the owner", guarded("CHECKS.md"), true)
same("CHECKS.md is under the file-size limit", tokensOf(Buffer.byteLength(table)) <= tokenLimit, true)
same("AGENTS.md has room to take a new rule", tokensOf(Buffer.byteLength(agents)) <= tokenLimit * 0.75, true)
