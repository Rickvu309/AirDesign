import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { ruleFileFor, ruleRowFaults, ruleRows } from "./rule-rows.mjs"
import { readRule, rules } from "./rules.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (file) => fs.readFileSync(path.join(root, file), "utf8")
const tracked = execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8" }).split("\n")
const commands = JSON.parse(read("package.json")).scripts

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const checks = read("CHECKS.md")
const withRow = (row) => ({ file: "CHECKS.md", before: checks, after: `${checks}${row}\n` })
const faultFiles = (faults) => faults.map((fault) => /Put it in ([^\s:]+)/.exec(fault)?.[1])

const authorsRow =
  '| A commit is authored by the owner and has no `Co-authored-by` trailer or AI attribution line; a PR body has no "Generated with" line | `scripts/commit-authors.mjs` refuses the commit. `pnpm land` refuses that line in a body file or an open pull request before the gate and names it |'
same(
  "replaying the CHECKS.md row of d08e3e607 fails and names the rule file beside commit-authors.mjs",
  faultFiles(ruleRowFaults(withRow(authorsRow), tracked, commands)),
  ["scripts/commit-authors.rule.md"],
)

const pptxRow =
  "| Untouched PowerPoint content survives byte for byte; edits change only their parts and add no validator error | `pnpm check:pptx`: untouched bytes; Microsoft validator against original. With `ci`, it is the whole merge test: no PowerPoint hand check |"
same(
  "replaying the CHECKS.md row of PR 912 fails and names the rule file of the script pnpm check:pptx runs",
  faultFiles(ruleRowFaults(withRow(pptxRow), tracked, commands)),
  ["scripts/pptx-check.rule.md"],
)

same(
  "a fault names the line and the rule",
  ruleRowFaults(withRow(pptxRow), tracked, commands)[0].startsWith(
    `CHECKS.md:${checks.split("\n").length}: "Untouched PowerPoint content survives byte for byte`,
  ),
  true,
)

same(
  "a rule that review holds may be added",
  ruleRowFaults(withRow("| Name a thing once | review |"), tracked, commands),
  [],
)

same(
  "a row kept from before is not refused again",
  ruleRowFaults(
    { file: "CHECKS.md", before: `${checks}${pptxRow}\n`, after: `${checks}${pptxRow}\n` },
    tracked,
    commands,
  ),
  [],
)

same(
  "a rule table split into a new file is refused too",
  ruleRowFaults(
    {
      file: "PICTURE-CHECKS.md",
      before: "",
      after: `# Pictures\n\n| Rule | Enforced by |\n| --- | --- |\n${authorsRow}\n`,
    },
    tracked,
    commands,
  ).length,
  1,
)

same(
  "a table that is not a rule table is left alone",
  ruleRowFaults({ file: "COMMANDS.md", before: "", after: "| Step | Runs |\n| --- | --- |\n| a | `b` |\n" }, tracked),
  [],
)

same(
  "a row naming no file still says where the rule goes",
  ruleFileFor("the `bar` check", tracked),
  "<name>.rule.md beside the check that holds it",
)

same(
  "every row left in CHECKS.md is held by review",
  ruleRows(checks).filter((row) => !row.heldBy.startsWith("review")),
  [],
)

same(
  "every rule file has a rule line and what holds it",
  rules(root)
    .filter((entry) => entry.rule === undefined)
    .map((entry) => entry.file),
  [],
)

same("a rule file without a heading reads as nothing", readRule("a rule\n\nits check\n"), undefined)
