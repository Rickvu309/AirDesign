import fs from "node:fs"
import { land, parseArgs } from "./land.mjs"

export const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}
export const fixture = (name) => fs.readFileSync(new URL(`./land-fixtures/${name}`, import.meta.url), "utf8")
export const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" })
export const no = (stderr = "", status = 1) => ({ status, stdout: "", stderr })

const mark = "<".repeat(7)
export const migrationsOf = (...hashes) => JSON.stringify(hashes.map((sha256, at) => ({ id: at + 1, sha256 })))

export const mainRules = (queue = true, required = ["ci"]) => ({
  refUpdateRule: { requiredStatusCheckContexts: required },
  rules: { nodes: queue ? [{ type: "MERGE_QUEUE", repositoryRuleset: { enforcement: "ACTIVE" } }] : [] },
})

const checkRun = [{ __typename: "CheckRun", name: "ci", conclusion: null, status: "IN_PROGRESS" }]

export const pullAnswer = ({
  armed = false,
  entry = null,
  merged = false,
  contexts = checkRun,
  base = "main",
  timeline = [],
  queue = true,
  head = "aaaa1111",
  required = ["ci"],
} = {}) =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          state: merged ? "MERGED" : "OPEN",
          merged,
          baseRefName: base,
          headRefOid: head,
          mergeable: "MERGEABLE",
          mergeStateStatus: "CLEAN",
          isInMergeQueue: entry !== null,
          mergeQueueEntry: entry,
          autoMergeRequest: armed ? { enabledAt: "x", mergeMethod: "REBASE" } : null,
          commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS", contexts: { nodes: contexts } } } }] },
          timelineItems: { nodes: timeline },
        },
        mergeQueue: queue ? { entries: { nodes: [] } } : null,
        ref: mainRules(queue, required),
      },
    },
  })

const unmoved = async () => ({ ok: true, lines: ["main has not moved since ci tested this head; nothing to recheck"] })

export const harness = (options = {}) => {
  const {
    args = [],
    dirty = "",
    branch = "land-command",
    pull = {
      number: 394,
      baseRefName: "main",
      url: "https://github.com/Rickvu309/AirDesign/pull/394",
      title: "Add pnpm land",
      body: "## Proof\n\nRan it.\n",
    },
    bodyText = "**Now:** A.\n**Proof:** Ran it.\n",
    conflicts = "",
    behind = "0",
    mainMigrations = migrationsOf("a", "b"),
    headMigrations = migrationsOf("a", "b", "c"),
    markerFiles = [],
    merges: mergeSubjects = [],
    staleDiff = "",
    staleLog = "",
    checkRuns = [{ status: 0, output: "ok lint 1s\n" }],
    alone = { status: 0, output: "" },
    changed = "",
    offBranch = [],
    issues = ok("[]"),
    pushed = ok(),
    merges = [ok()],
    reads = [pullAnswer({ armed: true }), pullAnswer({ merged: true })],
    recheck = unmoved,
    mainHeads = [],
  } = options
  const log = []
  const said = []
  const swept = []
  let readAt = 0
  let mergeAt = 0
  let checkAt = 0
  let mainAt = 0
  const git = (command) => {
    log.push(`git ${command.join(" ")}`)
    const [name] = command
    if (name === "rev-parse") return ok(command.some((word) => word.endsWith("^{tree}")) ? "tree\n" : `${branch}\n`)
    if (name === "commit-tree") return ok("rebuilt1111\n")
    if (name === "reset") return ok()
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
    if (name === "diff")
      return ok(command.includes("--raw") ? staleDiff : command.includes("origin/main...HEAD") ? changed : "")
    if (name === "merge-base")
      return command.includes("--is-ancestor") && offBranch.includes(command[2]) ? no("", 1) : ok("base\n")
    if (name === "log" && command.includes("--merges"))
      return ok(mergeSubjects.map((subject, at) => `${String(at + 1).repeat(40)}\0${subject}\n`).join(""))
    if (name === "log" && command.includes("--no-merges")) return ok("Finish the work\n")
    if (name === "log") return ok(command.includes("--raw") ? staleLog : "")
    throw new Error(`unexpected ${command.join(" ")}`)
  }
  const edits = []
  const raised = []
  const gh = (command, input) => {
    log.push(`gh ${command.join(" ")}`)
    if (command[0] === "repo") return ok("Rickvu309/AirDesign\n")
    if (command[0] === "issue" && command[1] === "list") return issues
    if (command[0] === "api" && command[1] === "graphql") return ok(JSON.stringify({ data: { search: { nodes: [] } } }))
    if (command[0] === "issue" && command[1] === "create") {
      raised.push({ title: command[command.indexOf("--title") + 1], body: input })
      return ok("https://github.com/Rickvu309/AirDesign/issues/990\n")
    }
    if (command[0] === "api" && command.includes("PATCH")) {
      edits.push({ path: command.find((word) => word.startsWith("repos/")), fields: JSON.parse(input) })
      return ok("{}")
    }
    if (command[0] === "pr" && command[1] === "list") return ok(pull === null ? "[]" : JSON.stringify([pull]))
    if (command[0] === "pr" && command[1] === "view") return ok(JSON.stringify(pull))
    if (command[0] === "pr" && command[1] === "create") return ok("https://github.com/Rickvu309/AirDesign/pull/394\n")
    if (command[0] === "pr" && command[1] === "merge") return merges[Math.min(mergeAt++, merges.length - 1)]
    if (command[0] === "api" && command[1]?.endsWith("/git/ref/heads/main"))
      return ok(`${mainHeads[Math.min(mainAt++, mainHeads.length - 1)]}\n`)
    if (command[0] === "run" && command[1] === "view") return ok(fixture("vitest-failed.log"))
    if (command[1] === "--paginate" && command[2]?.includes("/issues/394/comments?")) return ok("")
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
    recheck: async (asked) => {
      log.push(`recheck ${asked.number} ${asked.head}`)
      return recheck(asked)
    },
    readText: (file) => {
      log.push(`read ${file}`)
      if (bodyText === null) throw new Error(`ENOENT: no such file, open '${file}'`)
      return bodyText
    },
    sleep: (ms) => {
      clock += ms
    },
    now: () => clock,
    say: (line) => said.push(line),
    sweepPull:
      options.sweepPull ??
      ((asked) => {
        swept.push({ branch: asked.branch, number: asked.number, head: asked.head })
      }),
  }
  const pullReads = () => reads[Math.min(readAt++, reads.length - 1)]
  const run = async () => {
    const code = await land(context)
    const handEdit = said.find((line) => /gh pr (edit|create)/.test(line))
    if (handEdit !== undefined) throw new Error(`land told the agent to run gh by hand: ${handEdit}`)
    return code
  }
  return { context, log, said, edits, raised, swept, run }
}
