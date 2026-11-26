import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { runner } from "./land-git.mjs"
import {
  bodyFaults,
  branchBodyFaults,
  githubOffBranch,
  leadFaults,
  leadLimit,
  localOffBranch,
  templateSentences,
} from "./pr-body.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const fixture = (name) => fs.readFileSync(new URL(`./pr-body-fixtures/${name}`, import.meta.url), "utf8")
const repository = "Rickvu309/AirDesign"
const image = `![Annotated](https://github.com/${repository}/releases/download/proof/pr-1-annotated-1-abcdef1234.png)`
const clean = `## What changes\n\nA.\n\n## Proof\n\nRan it: 12 tests pass.\n`
const faultsOf = (body, options = {}) => bodyFaults(body, { repository, ...options })
const about = (faults, text) => faults.filter((fault) => fault.includes(text))

same("a clean body has no fault", faultsOf(clean), [])
same("an empty body has no fault", faultsOf(""), [])

const placeholder = `## What changes\n\nA.\n\n## Before / after\n\nPUBLISHED_IMAGES\n`
same("the pull request 657 draft's placeholder line is refused", faultsOf(placeholder), [
  "line 7 still holds the placeholder PUBLISHED_IMAGES. Replace it with what it stands for, or delete the line.",
])
same("a placeholder in braces is refused", about(faultsOf("See {BEFORE_AFTER} here.\n"), "BEFORE_AFTER").length, 1)
same("TODO is refused", about(faultsOf("Proof: TODO\n"), "TODO").length, 1)
for (const line of [
  "With no `SMOKE_TOKEN` the setup stops.",
  "serves mcp on the hosts in API_HOSTS and keeps localhost",
  "| internal-identifier | snake_case, SCREAMING_CASE |",
])
  same(`a name in a sentence is not a placeholder: ${line}`, faultsOf(`${line}\n`), [])
same("a placeholder in a fenced block is not judged", faultsOf("```\nPUBLISHED_IMAGES\n```\n"), [])

const leadOf = (body, changedFiles = []) => leadFaults(body, { repository, changedFiles })
const plain = "**Now:** the gate reads the change map.\n**Proof:** 12 script tests pass.\n"
const tree = `${image}\n\n<details><summary>Detail</summary>\n\n**Result.** The highlight sits on its line (Passed)\n\n- **A.** It stays inside the box (Passed)\n\n</details>\n`
const canvas = ["apps/web/src/editor/canvas.tsx"]
same("a body that opens with Now and Proof lines has a lead", leadOf(plain), [])
same("a body that opens with the tree picture and its result has a lead", leadOf(tree), [])
same(
  "a risk line and a Before / after section follow either lead",
  leadOf(`${plain}**Risk:** one-way: it drops a table.\n`),
  [],
)
same("a body that opens with a Summary heading has no lead", leadOf("## Summary\n\nA.\n\n## Evidence\n\nRan it.\n"), [
  "the body opens with neither lead. Open it with the tree picture from show-airdesign, published with verify-airdesign publish, and the tree's Markdown in a details block. For a change no person sees, open it with a **Now:** line and a **Proof:** line.",
])
same("a Now line with no Proof line is not a lead", leadOf("**Now:** the gate reads the change map.\n").length, 1)
same("a picture with no tree result is not a lead", leadOf(`${image}\n\nIt works.\n`).length, 1)
same("a change a person sees opens with the tree, not the plain lines", leadOf(plain, canvas), [
  "this changes what a person sees (apps/web/src/editor/canvas.tsx), so the body opens with the tree picture from show-airdesign and the tree's Markdown in a details block, not with the **Now:** line.",
])
same("a change a person sees with the tree passes", leadOf(tree, canvas), [])
same(
  "a change that touches seen files and shows nothing new may use the plain lines",
  leadOf(`${plain}\n## Before / after\n\nNo visible change: only a file moved.\n`, canvas),
  [],
)
const long = `${plain}\n${Array.from({ length: leadLimit }, (_, at) => `Line ${String(at)}.`).join("\n")}\n`
same("a body past the limit is refused, and the refusal counts its lines", leadOf(long), [
  `the body has ${String(leadLimit + 2)} lines outside its details block, over the limit of ${String(leadLimit)}. Cut it, or move the detail into the details block.`,
])
same(
  "lines inside the details block are not counted",
  leadOf(`${plain}\n<details><summary>Detail</summary>\n\n${"Line.\n".repeat(leadLimit * 2)}\n</details>\n`),
  [],
)

const [sentence] = templateSentences()
same("the template's sentences are read from the template", sentence.length > 20, true)
same("a template sentence left in the body is refused", faultsOf(`## What changes\n\n${sentence}\n`), [
  `line 3 still holds the template's sentence "${sentence}". Write what it asks for, or delete the line.`,
])

const pr668 = faultsOf(fixture("pr-668.md"))
same("pull request 668's merged body names a local image path", pr668.length, 1)
same(
  "and the fault names the line and the path",
  /^line 20 names a local path \(~\/tmp\/verify-airdesign\//.test(pr668[0]),
  true,
)
same("and says how to fix it", pr668[0].includes("verify-airdesign publish"), true)
for (const line of [
  "evidence under ~/tmp/verify-airdesign/<run>/proof.md",
  "`ENOENT` on `/tmp/check-*/airdesign-resend-*.json`",
  "the cache lives in ~/.cache/airdesign/check-queue.jsonl",
  "[log](https://example.com/tmp/run.log)",
  "/tmp/ is wiped on reboot",
  "a body cites `~/tmp/…` or `/home/…` paths",
])
  same(`a path that names no file of this machine passes: ${line}`, faultsOf(`${line}\n`), [])
for (const line of [
  "Log: /home/quanvm/tmp/ui-audit/consent-browser-r2.log",
  "Log: `~/tmp/coordinator/motion/K1-main-design.log`.",
  "![shot](/tmp/claude-1000/shot.png)",
  "see file:///home/quanvm/x.png",
])
  same(`a local path is refused: ${line}`, about(faultsOf(`${line}\n`), "names a local path").length, 1)

const offBranchAt6c413e4b = (sha) => sha === "ed84dea7"
const pr649 = about(faultsOf(fixture("pr-649.md"), { offBranch: offBranchAt6c413e4b }), "names commit")
same("pull request 649 at 6c413e4b names ed84dea7, which its head did not have", pr649, [
  "line 25 names commit ed84dea7, which is on neither this branch nor main, so it is an old head or another branch. Measure again at the head, or drop the claim. To compare with an old head on purpose, call it that without its hash.",
])
same(
  "a hash in an image name or a number is not a commit",
  faultsOf(`${image}\n\nCI job 133478061620 failed.\n`, { offBranch: () => true }),
  [],
)
same(
  "a commit after at, on, head or commit is judged without backticks",
  faultsOf("Measured at ab12cd34.\n", { offBranch: () => true }).length,
  1,
)

const seenFiles = ["apps/web/src/editor/format-buttons.tsx", "apps/web/src/editor/format-buttons.test.tsx"]
const pr664 = faultsOf(fixture("pr-664.md"), {
  changedFiles: [...seenFiles, "tests/browser/text-style.spec.ts"],
})
same("pull request 664 at 617d12f8 changes the toolbar and has no Before / after", pr664.length, 1)
same(
  "and the fault names the file and both ways out",
  pr664[0].includes("apps/web/src/editor/format-buttons.tsx") && pr664[0].includes("No visible change: <why>"),
  true,
)
same(
  "pull request 643 changes the editor grid and its merged body has no Before / after",
  about(
    faultsOf(fixture("pr-643.md"), {
      changedFiles: ["apps/web/src/editor/editor-grid.tsx", "packages/theme/src/tokens.css"],
    }),
    "what a person sees",
  ).length,
  1,
)
same(
  "a Before / after image from the proof release passes",
  faultsOf(`${clean}\n## Before / after\n\n${image}\n`, { changedFiles: seenFiles }),
  [],
)
same(
  "a written no-visible-change line passes",
  faultsOf(
    `${clean}\n## Before / after\n\nNo visible change: moves code between files; the editor paints the same.\n`,
    {
      changedFiles: seenFiles,
    },
  ),
  [],
)
same(
  "a no-visible-change line with no reason does not pass",
  faultsOf(`${clean}\n## Before / after\n\nNo visible change: none\n`, { changedFiles: seenFiles }).length,
  1,
)
same(
  "a no-visible-change line outside the section does not pass",
  faultsOf(`${clean}\nNo visible change: moves code between files; the editor paints the same.\n`, {
    changedFiles: seenFiles,
  }).length,
  1,
)
same("a change nobody sees needs no Before / after", faultsOf(clean, { changedFiles: ["scripts/land.mjs"] }), [])

const compareAt649 = (sha, side) =>
  ({ "ed84dea7 head": "diverged", "ed84dea7 base": "diverged", "21fb698e head": "diverged", "21fb698e base": "ahead" })[
    `${sha} ${side}`
  ]
same(
  "bar finds a commit pull request 649 named that its head 6c413e4b lacks",
  githubOffBranch(compareAt649)("ed84dea7"),
  true,
)
same("bar lets a body name a commit of main", githubOffBranch(compareAt649)("21fb698e"), false)
same("bar lets a body name a commit of its head", githubOffBranch(() => "ahead")("6c413e4b"), false)
same("bar skips a hash GitHub cannot find", githubOffBranch(() => undefined)("abcdef1"), false)

const home = fs.mkdtempSync(path.join(os.tmpdir(), "pr-body-"))
const git = runner("git", home)
const run = (...args) =>
  execFileSync("git", args, {
    cwd: home,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "a",
      GIT_AUTHOR_EMAIL: "a@a",
      GIT_COMMITTER_NAME: "a",
      GIT_COMMITTER_EMAIL: "a@a",
    },
  }).trim()
const commit = (file) => {
  fs.writeFileSync(path.join(home, file), file)
  run("add", file)
  run("commit", "-q", "-m", file)
  return run("rev-parse", "HEAD")
}
try {
  run("init", "-q", "-b", "main")
  const fork = commit("fork.txt")
  const later = commit("later.txt")
  run("update-ref", "refs/remotes/origin/main", later)
  run("switch", "-q", "-c", "work", fork)
  const old = commit("work.txt")
  run("commit", "-q", "--amend", "-m", "work again")
  const head = run("rev-parse", "HEAD")
  const offBranch = localOffBranch(git)
  same("a commit of this branch is on it", offBranch(head.slice(0, 8)), false)
  same("a commit of main the branch has not taken is on main", offBranch(later.slice(0, 8)), false)
  same("an amended old head is on neither", offBranch(old.slice(0, 8)), true)
  same("a hash that names no commit is not judged", offBranch("abcdef1234"), false)
  run("switch", "-q", "-c", "seen", "main")
  fs.mkdirSync(path.join(home, "apps/web/src"), { recursive: true })
  commit("apps/web/src/panel.tsx")
  same(
    "land reads the changed files from git and asks for a Before / after",
    about(branchBodyFaults({ body: clean, git, repository }), "apps/web/src/panel.tsx").length,
    1,
  )
} finally {
  fs.rmSync(home, { recursive: true, force: true })
}
