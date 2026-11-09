import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { budget, report, ruleGaps, sourceLines } from "./bug-rule.mjs"

const write = (root, relative, source) => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, source)
}

const sample = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-budget-"))
  write(root, "apps/kept.ts", "export const saved = 1\n\nexport const next = 2\n")
  write(root, "apps/blank.ts", "\n\n")
  write(root, "apps/kept.test.ts", "export const saved = 1\n")
  write(root, "apps/fixtures/hidden.ts", "export const saved = 1\n")
  write(root, "apps/node_modules/hidden.ts", "export const saved = 1\n")
  write(root, "packages/kept.ts", "export const saved = 1\n")
  write(root, "packages/edge/boundary-fixtures/hidden.ts", "export const saved = 1\n")
  write(root, "tooling/rule.js", "export const rule = 1\n")
  write(root, "tooling/rule.test.js", "export const rule = 1\n")
  write(root, "scripts/check.mjs", "export const check = 1\n")
  write(root, "scripts/note.md", "not code\n")
  return root
}

const counted = sourceLines(sample(), "apps")
if (counted !== 2) throw new Error(`apps count skipped a real line or kept a blank one: ${counted}`)

const under = budget(sample())
if (under.product !== 3 || under.processLines !== 2 || under.over) {
  throw new Error(`small trees stay under the cap\n${JSON.stringify(under)}`)
}

const wide = sample()
write(wide, "apps/more.ts", `${"export const saved = 1\n".repeat(1999)}`)
write(wide, "tooling/more.js", `${"export const rule = 1\n".repeat(201)}`)
const open = budget(wide)
if (open.product !== 2002 || open.processLines !== 203 || !open.over) {
  throw new Error(`a wide tree must retire a rule\n${JSON.stringify(open)}`)
}
const lines = report(open)
if (!lines.includes("product 2002") || !lines.includes("tooling and scripts 203") || !lines.includes("percent 10.1")) {
  throw new Error(`report missed the counts\n${lines.join("\n")}`)
}

const capped = sample()
write(capped, "apps/more.ts", `${"export const saved = 1\n".repeat(1997)}`)
write(capped, "tooling/more.js", `${"export const rule = 1\n".repeat(500)}`)
const resting = budget(capped)
if (resting.product !== 2000 || resting.over) {
  throw new Error(`the cap waits until product code passes 2000 lines\n${JSON.stringify(resting)}`)
}

const plugin = sample()
const rules = "tooling/oxlint-plugin-airdesign/rules"
write(plugin, `${rules}/no-comments.js`, "export default {}\n")
write(plugin, "tooling/oxlint-plugin-airdesign/index.js", 'import rule from "./rules/no-comments.js"\n')
write(plugin, "tooling/oxlint-plugin-airdesign/oxlintrc.json", '{ "rules": { "airdesign/no-comments": "error" } }\n')
const missing = ruleGaps(plugin)
if (missing.length !== 1 || missing[0] !== "no-comments has no test") {
  throw new Error(`a rule without a test must be named\n${missing.join("\n")}`)
}
write(plugin, `${rules}/no-comments.test.js`, "export const saved = 1\n")
if (ruleGaps(plugin).length !== 0) throw new Error("a wired rule was reported as a gap")

console.log("bug-rule tests passed")
