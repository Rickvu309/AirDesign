import fs from "node:fs"
import { land, parseArgs } from "./land.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
const fixture = (name) => fs.readFileSync(new URL(`./land-fixtures/${name}`, import.meta.url), "utf8")
const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" })
const no = (stderr = "", status = 1) => ({ status, stdout: "", stderr })

const mark = "<".repeat(7)
const migrationsOf = (...hashes) => JSON.stringify(hashes.map((sha256, at) => ({ id: at + 1, sha256 })))

const pullAnswer = ({ armed = false, entry = null, merged = false, contexts = [], base = "main" } = {}) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          state: merged ? "MERGED" : "OPEN",
          merged,
          baseRefName: base,
          headRefOid: "aaaa1111",
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          isInMergeQueue: entry !== null,
          mergeQueueEntry: entry,
          autoMergeRequest: armed ? { enabledAt: "x", mergeMethod: "REBASE" } : null,
          commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS", contexts: { nodes: contexts } } } }] },
        },
        mergeQueue: { entries: { nodes: [] } },
      },
    },
  })

const harness = (options = {}) => {
  const {
    args = [],
    dirty = "",
    branch = "land-command",
    pull = { number: 394, baseRefName: "main", url: "https://github.com/Rickvu309/AirDesign/pull/394" },
    conflicts = "",
    behind = "0",
    mainMigrations = migrationsOf("a", "b"),
    headMigrations = migrationsOf("a", "b", "c"),
    markerFiles = [],
    checkRuns = [{ status: 0, output: "ok lint 1s\n" }],
    alone = { status: 0, output: "" },
    pushed = ok(),
    merges = [ok()],
    reads = [pullAnswer({ armed: true }), pullAnswer({ merged: true })],
  } = options
  const log = []
  const said = []
  let readAt = 0
  let mergeAt = 0
  let checkAt = 0
  const git = (command) => {
    log.push(`git ${command.join(" ")}`)
    const [name] = command
    if (name === "rev-parse") return ok(`${branch}\n`)
    if (name === "status") return ok(dirty)
    if (name === "fetch") return ok()
    if (name === "merge-tree")
      return conflicts === "" ? ok("tree\n") : { status: 1, stdout: `tree\n${conflicts}\n\nCONFLICT\n`, stderr: "" }
    if (name === "rev-list") return ok(`${behind}\n`)
    if (name === "grep")
      return markerFiles.length === 0 ? no("", 1) : ok(markerFiles.map((file) => `HEAD:${file}\n`).join(""))
    if (name === "show")
      return command[1].startsWith("origin/main:")
        ? ok(mainMigrations)
        : command[1].startsWith("HEAD:apps/api")
          ? ok(headMigrations)
          : ok(`${mark} HEAD\nx\n`)
    if (name === "push") return pushed
    if (name === "cat-file") return ok()
    if (name === "diff") return ok()
    throw new Error(`unexpected ${command.join(" ")}`)
  }
  const gh = (command) => {
    log.push(`gh ${command.join(" ")}`)
    if (command[0] === "repo") return ok("Rickvu309/AirDesign\n")
    if (command[0] === "pr" && command[1] === "list") return ok(pull === null ? "[]" : JSON.stringify([pull]))
    if (command[0] === "pr" && command[1] === "view") return ok(JSON.stringify(pull))
    if (command[0] === "pr" && command[1] === "create") return ok("https://github.com/Rickvu309/AirDesign/pull/394\n")
    if (command[0] === "pr" && command[1] === "merge") return merges[Math.min(mergeAt++, merges.length - 1)]
    if (command[0] === "run" && command[1] === "view") return ok(fixture("vitest-failed.log"))
    if (command[1]?.includes("/actions/workflows/")) return ok("[]")
    if (command[1]?.endsWith("/artifacts")) return ok("")
    throw new Error(`unexpected ${command.join(" ")}`)
  }
  let clock = 0
  const context = {
    args: parseArgs(args),
    git,
    gh,
    read: () => pullReads(),
    check: async () => checkRuns[Math.min(checkAt++, checkRuns.length - 1)],
    rerun: async (file) => {
      log.push(`rerun ${file}`)
      return alone
    },
    stamp: () => log.push("stamp"),
    sleep: (ms) => {
      clock += ms
    },
    now: () => clock,
    say: (line) => said.push(line),
  }
  const pullReads = () => reads[Math.min(readAt++, reads.length - 1)]
  return { context, log, said, run: () => land(context) }
}

const failedLoad = { status: 1, output: fixture("vitest-failed.log") }

const clean = harness()
same("a clean branch lands and follows to merged", await clean.run(), 0)
same(
  "the push uses a lease",
  clean.log.some((line) => line.startsWith("git push --force-with-lease")),
  true,
)
same(
  "the commit is stamped before the push",
  clean.log.indexOf("stamp") < clean.log.findIndex((line) => line.startsWith("git push")),
  true,
)
same(
  "a failed step stops nothing here: every step said one line",
  clean.said.filter((line) =>
    /^(branch|fetch|base|conflicts|migrations|markers|check|push|pull request|queue|follow)/.test(line),
  ).length >= 10,
  true,
)

const conflicted = harness({ conflicts: "apps/web/src/thin-deck.tsx" })
same("a branch that conflicts with main stops before the check", await conflicted.run(), 1)
same("and runs no check", conflicted.log.includes("stamp"), false)
same(
  "and names the file and the rebase",
  conflicted.said.some(
    (line) => line.includes("apps/web/src/thin-deck.tsx") && line.includes("git rebase origin/main"),
  ),
  true,
)

const wrongBase = harness({ pull: { number: 403, baseRefName: "agent-element-tools", url: "u" } })
same("a pull request against another branch stops", await wrongBase.run(), 1)
same(
  "and names the fix",
  wrongBase.said.some((line) => line.includes("gh pr edit 403 --base main")),
  true,
)
same(
  "and pushes nothing",
  wrongBase.log.some((line) => line.startsWith("git push")),
  false,
)

const twice = harness({
  mainMigrations: migrationsOf("a", "b", "main-nine"),
  headMigrations: migrationsOf("a", "b", "branch-nine"),
})
same("two migrations with one number stop before the check", await twice.run(), 1)
same(
  "and name the next free number",
  twice.said.some((line) => line.includes("next free number, 4")),
  true,
)

const marked = harness({ markerFiles: ["apps/web/src/thin-deck.tsx"] })
same("a committed conflict marker stops the push", await marked.run(), 1)
same(
  "and names the file",
  marked.said.some((line) => line.includes("apps/web/src/thin-deck.tsx")),
  true,
)
same(
  "and pushes nothing",
  marked.log.some((line) => line.startsWith("git push")),
  false,
)

const load = harness({ checkRuns: [failedLoad], alone: { status: 0, output: "" } })
same("a failed test that passes alone is load and lands", await load.run(), 0)
same("the file was rerun alone", load.log.includes("rerun apps/api/src/agent-commit-race.test.ts"), true)
same("and the commit is stamped by land", load.log.includes("stamp"), true)

const real = harness({
  checkRuns: [failedLoad],
  alone: { status: 1, output: " FAIL  api apps/api/src/agent-commit-race.test.ts > a > b\nAssertionError: boom\n" },
})
same("a failed test that fails alone too stops the push", await real.run(), 1)
same("and stamps nothing", real.log.includes("stamp"), false)
same(
  "and pushes nothing",
  real.log.some((line) => line.startsWith("git push")),
  false,
)
same(
  "and names the failing test",
  real.said.some((line) => line.includes("apps/api/src/agent-commit-race.test.ts")),
  true,
)

const queueText = "the merge strategy for main is set by the merge queue"
const unqueued = harness({
  merges: [{ status: 0, stdout: "", stderr: `${queueText}\n` }],
  reads: [pullAnswer()],
})
same("a pull request gh left unqueued is a loud failure", await unqueued.run(), 1)
same(
  "and quotes what gh said",
  unqueued.said.some((line) => line.includes(queueText)),
  true,
)

const dirty = harness({ dirty: " M scripts/land.mjs\n" })
same("uncommitted files stop the land", await dirty.run(), 1)

const checkOnly = harness({ args: ["--check"] })
same("--check stops after the stamp", await checkOnly.run(), 0)
same(
  "and pushes nothing",
  checkOnly.log.some((line) => line.startsWith("git push")),
  false,
)

const noPull = harness({ pull: null })
same("no pull request and no title stops after the push with the command", await noPull.run(), 1)
same(
  "and says how to open one against main",
  noPull.said.some((line) => line.includes("gh pr create --base main")),
  true,
)

const created = harness({ pull: null, args: ["--title", "Add land", "--body-file", "/tmp/body.md", "--no-follow"] })
created.context.gh = ((original) => (command) => {
  if (command[0] === "pr" && command[1] === "list" && created.log.some((line) => line.startsWith("gh pr create"))) {
    return ok(JSON.stringify([{ number: 394, baseRefName: "main", url: "u" }]))
  }
  return original(command)
})(created.context.gh)
same("a title and a body file open the pull request against main", await created.run(), 0)
same(
  "with --base main",
  created.log.some((line) => line.startsWith("gh pr create --base main")),
  true,
)

const watch = harness({ args: ["--watch"], reads: [pullAnswer({ merged: true })] })
same("--watch only follows", await watch.run(), 0)
same("and checks nothing", watch.log.includes("stamp"), false)

const status = harness({ args: ["--status"], reads: [pullAnswer({ armed: true })] })
same("--status changes nothing and exits 0", await status.run(), 0)
same(
  "it pushes, merges and stamps nothing",
  status.log.some((line) => /^git push|^gh pr merge|^stamp/.test(line)),
  false,
)
same(
  "it says where the pull request stands",
  status.said.some((line) => line.includes("auto-merge is armed")),
  true,
)
