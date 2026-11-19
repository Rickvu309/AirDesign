import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { judges } from "./bar-files.mjs"
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
same("a change to CHECKS.md alone changes no check", judges("CHECKS.md"), false)
same("the file-size check covers CHECK-QUEUE.md", authored("CHECK-QUEUE.md"), true)
same("CHECKS.md is under the file-size limit", tokensOf(Buffer.byteLength(table)) <= tokenLimit, true)
same(
  "AGENTS.md stays short enough to read whole on every turn",
  tokensOf(Buffer.byteLength(agents)) <= tokenLimit * 0.4,
  true,
)
same("AGENTS.md names the file that holds each command's detail", agents.includes("`COMMANDS.md`"), true)
same("AGENTS.md leaves each command's detail to COMMANDS.md", agents.includes("## Commands"), false)
same(
  "COMMANDS.md says what the gate, ci and land run",
  ["`pnpm gate`", "`ci`", "`pnpm land`"].every((name) => read("COMMANDS.md").includes(name)),
  true,
)
same("a change to COMMANDS.md alone changes no check", judges("COMMANDS.md"), false)
same("the file-size check covers COMMANDS.md", authored("COMMANDS.md"), true)
same(
  "AGENTS.md says what every app and package is for",
  ["apps", "packages"].flatMap((folder) =>
    fs
      .readdirSync(path.join(root, folder))
      .filter((name) => !agents.includes(folder === "apps" ? `\`apps/${name}\` is` : `  - \`${name}\` `)),
  ),
  [],
)
