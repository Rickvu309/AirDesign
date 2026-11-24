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

const pdfRow = "| PDF pages keep their fonts and text | `pnpm check:pdf` reads the exported file |"
same(
  "a PDF check row names the rule file beside the PDF check script",
  faultFiles(ruleRowFaults(withRow(pdfRow), tracked, commands)),
  ["scripts/pdf-check.rule.md"],
)

same(
  "a fault names the line and the rule",
  ruleRowFaults(withRow(pdfRow), tracked, commands)[0].startsWith(
    `CHECKS.md:${checks.split("\n").length}: "PDF pages keep their fonts and text`,
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
    { file: "CHECKS.md", before: `${checks}${pdfRow}\n`, after: `${checks}${pdfRow}\n` },
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
