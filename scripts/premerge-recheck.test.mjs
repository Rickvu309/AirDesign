import { fixture, ok, same } from "./land-harness.mjs"
import { premergeRecheck } from "./premerge-recheck.mjs"

const head = "cd01ecb4008ee708b931ee16449d9d9b0ba075b6"
const tested = "50ca910d1dda131fc5fe61552ba90caf6beafb3d"
const shortcuts = "2a7448aa0271ce393c841d8df510300c76b767d8"
const unrelated = "e05168b79e05168b79e05168b79e05168b79e051"

const shortcutsCommit = [
  `\u0001${shortcuts}\u0000Open a keyboard shortcuts panel with Ctrl+Shift+?, read from the gesture table`,
  "",
  "apps/web/src/copy/shortcut-copy.ts",
  "apps/web/src/editor/shortcuts-panel.tsx",
  "packages/render/src/gestures.ts",
  "",
].join("\n")
const unrelatedCommit = [
  `\u0001${unrelated}\u0000Keep the editor Saving until all pending edits land`,
  "",
  "apps/web/src/editor/save-status.ts",
  "",
].join("\n")

const replay = ({
  main = shortcuts,
  moved = shortcutsCommit,
  runs = [
    {
      id: 44668286213,
      event: "pull_request",
      branch: "t3/canvas-duplicate-layers-figma",
      head,
      createdAt: "2026-11-20T03:31:16Z",
    },
  ],
  conflicts = "",
  gate = { status: 1, output: fixture("recheck-970-gate.log"), log: "/scratch/recheck/77e158c8b01b.log" },
} = {}) => {
  const log = []
  const gated = []
  let clock = 0
  const git = (command) => {
    log.push(`git ${command.join(" ")}`)
    const [name] = command
    if (name === "fetch") return ok()
    if (name === "rev-parse") return ok(`${main}\n`)
    if (name === "merge-base") return ok(`${tested}\n`)
    if (name === "log") return ok(command.at(-1) === `${tested}..${main}` ? moved : "")
    if (name === "merge-tree")
      return conflicts === ""
        ? ok("mergedtree\n")
        : { status: 1, stdout: `mergedtree\n${conflicts}\n\nCONFLICT\n`, stderr: "" }
    if (name === "commit-tree") return ok("recheck1111\n")
    throw new Error(`unexpected git ${command.join(" ")}`)
  }
  const gh = (command) => {
    log.push(`gh ${command.join(" ")}`)
    if (command[1].includes("/actions/workflows/ci.yml/runs?head_sha=")) return ok(JSON.stringify(runs))
    if (command[1].includes("/commits?sha=main&until=")) return ok(`${tested}\n`)
    throw new Error(`unexpected gh ${command.join(" ")}`)
  }
  const run = () =>
    premergeRecheck({
      git,
      gh,
      repository: "Rickvu309/AirDesign",
      head,
      gate: async (asked) => {
        gated.push(asked)
        clock += 64300
        return gate
      },
      now: () => clock,
    })
  return { log, gated, run }
}

const pr970 = replay()
const caught = await pr970.run()
same("the replay of pull request 970 on main 2a7448aa0 fails the recheck", caught.ok, false)
same("the gate runs once, on the merge of the head and the newest main, against that main", pr970.gated, [
  { commit: "recheck1111", main: shortcuts },
])
same(
  "the merge is one commit on main holding the merged tree, so the gate's linear-branch rule judges it as a rebase",
  pr970.log.includes(`git commit-tree mergedtree -p ${shortcuts} -m Recheck ${head} on ${shortcuts}`),
  true,
)
same(
  "it names the steps the queue run 44669074586 failed",
  caught.lines.some((line) => line.includes("fails copy-in-tests, build")),
  true,
)
same(
  "it prints the type error main's ci would have hit",
  caught.lines.some((line) => line.includes("src/copy/shortcut-copy.ts(18,3): error TS2739")),
  true,
)
same(
  "it leaves out the gate's own planning notes",
  caught.lines.some((line) => /: (?:gate|affected report): /.test(line)),
  false,
)
same(
  "it names the main commit it clashes with",
  caught.lines.some((line) => line.includes("2a7448aa Open a keyboard shortcuts panel")),
  true,
)
same(
  "it says the base ci tested and how far main moved",
  caught.lines.some((line) => line.includes("50ca910d") && line.includes("1 commit")),
  true,
)
same(
  "it says how long the recheck took",
  caught.lines.some((line) => line.includes("64 s")),
  true,
)
same(
  "it points at the full log",
  caught.lines.some((line) => line.includes("/scratch/recheck/77e158c8b01b.log")),
  true,
)

const twoMoved = replay({ moved: `${unrelatedCommit}${shortcutsCommit}` })
const narrowed = await twoMoved.run()
same(
  "of the commits main gained, only the one touching a file in the failure is named as the clash",
  [narrowed.lines.some((line) => line.includes("2a7448aa")), narrowed.lines.some((line) => line.includes("e05168b7"))],
  [true, false],
)

const still = replay({ main: tested, moved: "" })
const unmoved = await still.run()
same("when main has not moved past the base ci tested, there is nothing to recheck", unmoved.ok, true)
same("and no gate runs", still.gated, [])
same(
  "and it says so",
  unmoved.lines.some((line) => line.includes("has not moved")),
  true,
)

const green = replay({ gate: { status: 0, output: "ok lint 1s\n", log: "/scratch/recheck/x.log" } })
const passed = await green.run()
same("a head that merges cleanly with the newest main and passes the gate passes", passed.ok, true)
same(
  "and the line names the head, main and the time",
  passed.lines.some((line) => line.includes("cd01ecb4") && line.includes("2a7448aa") && line.includes("64 s")),
  true,
)

const clash = replay({ conflicts: "apps/web/src/copy/shortcut-copy.ts" })
const conflicted = await clash.run()
same("a head that conflicts with the newest main fails without a gate", [conflicted.ok, clash.gated.length], [false, 0])
same(
  "and names the file and the main commit that touched it",
  conflicted.lines.some((line) => line.includes("apps/web/src/copy/shortcut-copy.ts")) &&
    conflicted.lines.some((line) => line.includes("2a7448aa")),
  true,
)

const unknown = replay({ runs: [] })
await unknown.run()
same(
  "with no ci run on the head, the merge base stands in for the tested base",
  unknown.log.some((line) => line.startsWith("git merge-base")),
  true,
)
same("and the recheck still runs", unknown.gated.length, 1)
