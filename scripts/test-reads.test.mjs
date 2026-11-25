import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { proofPlan } from "../.agents/skills/verify-airdesign/bin/prove-plan.mjs"
import { readersOf, testReads } from "./test-reads.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-test-reads-"))
try {
  const put = (file, text = "") => {
    fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true })
    fs.writeFileSync(path.join(folder, file), text)
  }
  put("AGENTS.md")
  put("CHECKS.md")
  put(".github/workflows/ci.yml")
  put(".github/workflows/deploy.yml")
  put(".github/actions/queued/action.yml")
  put("specs/doom-runs/DoomRuns.tla")
  put("apps/web/src/thin-deck.tsx")
  put("apps/web/src/other.tsx")
  put("scripts/gate.mjs")
  put("tests/browser/home.spec.ts")
  put("scripts/limit.test.mjs", 'const agents = read("AGENTS.md")\nconst note = "`CHECKS.md` is the table"\n')
  put("scripts/workflow.test.mjs", 'readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8")\n')
  put(
    "scripts/folders.test.mjs",
    'const queued = ".github/actions/queued"\nconst specs = "specs/doom-runs/"\n\n\n\n\nreaddirSync(path.join(root, queued))\nreaddirSync(specs)\n',
  )
  put(
    "scripts/app.test.mjs",
    'const file = "apps/web/src/thin-deck.tsx"\nconst web = "apps/web/src"\n\n\n\n\nreadFileSync(file)\nreaddirSync(web)\n',
  )
  put("scripts/gone.test.mjs", 'read("docs/removed-guide.md")\nread("scripts/gate.mjs")\nread("scripts")\n')
  put(
    "scripts/sample.test.mjs",
    'const sample = "tests/browser/home.spec.ts"\nconst missing = "tests/browser/gone.spec.ts"\n',
  )
  put(
    "scripts/named.test.mjs",
    'areaOf("apps/web/src/other.tsx")\nwrite(".github/workflows/deploy.yml", "jobs: {}")\n\n\n\n\nreadFileSync(real)\n',
  )
  put("scripts/quiet.test.mjs", 'import { gate } from "./gate.mjs"\nconst text = "no path here"\n')
  put("scripts/notscript.mjs", 'read("AGENTS.md")\n')
  put("packages/doom/src/library/themes/plain.json")
  put("apps/web/public/favicon.svg")
  put("packages/doom/src/themes.test.ts", 'readdirSync("packages/doom/src/library/themes")\n')
  put("apps/web/src/favicon.test.ts", "readFileSync(new URL(`../public/${name}`, import.meta.url))\n")
  put("apps/site/src/other-app.test.ts", 'readdirSync("packages/doom/src/library/themes")\n')
  put("scripts/shards.test.mjs", 'const files = names.map((name) => `tests/browser/${name}`).join(" ")\n')
  const tracked = execFileSync("find", [".", "-type", "f"], { cwd: folder, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .map((file) => file.slice(2))
  const reads = testReads(folder, tracked)

  same("a test that reads a root file by name is linked to it", readersOf(reads, "AGENTS.md"), [
    "scripts/limit.test.mjs",
  ])
  same("a name in backticks inside a sentence is still a path", readersOf(reads, "CHECKS.md"), [
    "scripts/limit.test.mjs",
  ])
  same("a path joined from separate segments is linked to the file", readersOf(reads, ".github/workflows/ci.yml"), [
    "scripts/workflow.test.mjs",
  ])
  same(
    "a folder two levels deep is linked to every file under it, and a sibling folder is not",
    [
      readersOf(reads, ".github/actions/queued/action.yml"),
      readersOf(reads, "specs/doom-runs/DoomRuns.tla"),
      readersOf(reads, ".github/workflows/deploy.yml"),
    ],
    [["scripts/folders.test.mjs"], ["scripts/folders.test.mjs"], []],
  )
  same(
    "a file inside an app is linked by its own path, and a folder inside an app links nothing",
    [readersOf(reads, "apps/web/src/thin-deck.tsx"), readersOf(reads, "apps/web/src/other.tsx")],
    [["scripts/app.test.mjs"], []],
  )
  same(
    "a file that no longer exists stays linked by the name the test still reads, so its deletion selects the test",
    readersOf(reads, "docs/removed-guide.md"),
    ["scripts/gone.test.mjs"],
  )
  same(
    "a top-level folder name alone links nothing, or every change would select every test",
    [readersOf(reads, "scripts/gate.mjs"), readersOf(reads, "scripts/limit.test.mjs")],
    [["scripts/gone.test.mjs"], []],
  )
  same(
    "a spec a test only names as a sample is no link, so a spec change does not select it",
    [readersOf(reads, "tests/browser/home.spec.ts"), readersOf(reads, "tests/browser/gone.spec.ts")],
    [[], []],
  )
  same(
    "a path only named as an argument far from any read is no link, so a sample name selects nothing",
    [readersOf(reads, "apps/web/src/other.tsx"), readersOf(reads, ".github/workflows/deploy.yml")],
    [[], []],
  )
  same(
    "a unit test reads a folder of its own package, and a test outside that package does not link it",
    readersOf(reads, "packages/doom/src/library/themes/new.json"),
    ["packages/doom/src/themes.test.ts"],
  )
  same(
    "a relative template path that ends in a folder links that folder, and a template that only builds names does not",
    [readersOf(reads, "apps/web/public/favicon-32.png"), readersOf(reads, "tests/browser/home.spec.ts")],
    [["apps/web/src/favicon.test.ts"], []],
  )
  same("a script that is not a test is no reader", Object.keys(reads).includes("scripts/notscript.mjs"), false)
  same("a test with no path reads nothing", reads["scripts/quiet.test.mjs"], [])
} finally {
  fs.rmSync(folder, { recursive: true, force: true })
}

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean)
const real = testReads(root, tracked)

same(
  "AGENTS.md is read by the test that holds its size",
  readersOf(real, "AGENTS.md").includes("scripts/rule-table.test.mjs"),
  true,
)
same(
  "ci.yml is read by the test that holds its size",
  readersOf(real, ".github/workflows/ci.yml").includes("scripts/affected-report.test.mjs"),
  true,
)
same(
  "a size limit on a file is held by a test the gate would name",
  ["COMMANDS.md", "CHECKS.md", ".oxfmtrc.json", ".railway/railway.ts", "specs/doom-runs/DoomRuns.tla"].map(
    (file) => readersOf(real, file).length > 0,
  ),
  [true, true, true, true, true],
)
same(
  "the feature map test reads the journeys and the feature files, which PRs 1661, 1664 and 1666 added without running it",
  [
    ".agents/skills/verify-airdesign/journeys/new-journey.mjs",
    ".agents/skills/verify-airdesign/features/new-feature.md",
  ].map((file) => readersOf(real, file).includes(".agents/skills/verify-airdesign/features/features.test.mjs")),
  [true, true],
)
same("no test reads a path nobody wrote", readersOf(real, "no/such/file.txt"), [])

const toolingFor = (changed) =>
  proofPlan({ base: "main", head: "head", changed, reads: real }).steps.find((step) => step.kind === "script-tests")
    ?.files ?? []

same(
  "a change to AGENTS.md alone plans the test that holds its size, as PR 1036's first failure needed",
  toolingFor(["AGENTS.md"]).includes("scripts/rule-table.test.mjs"),
  true,
)
same(
  "a change to ci.yml alone plans the test that holds its size, as PR 1036's second failure needed",
  toolingFor([".github/workflows/ci.yml"]).includes("scripts/affected-report.test.mjs"),
  true,
)
same("a change nothing reads plans no script test", toolingFor(["apps/web/src/decks/home.tsx"]), [])
