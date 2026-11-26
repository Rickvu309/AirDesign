import { attributionLine } from "./commit-authors.mjs"
import { deckStateFile, deckStateNote } from "./deck-state-file.mjs"
import { raceKey, raceTitle, recordRace } from "./race-issue.mjs"

const same = (what, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}\n${JSON.stringify(actual, null, 1)}\n${JSON.stringify(expected, null, 1)}`)
  }
}

const repository = "Rickvu309/AirDesign"
const issueUrl = (number) => `https://github.com/${repository}/issues/${number}`
const frameGroupMove = {
  file: "tests/browser/frame-group-move.spec.ts",
  line: 41,
  name: "a layer inside a group inside a frame moves where it is dropped, and the group grows to hold it",
}
const fixMerge = "b2a45ec0445a500f861ce38817b77687f02c7e22"
const oldBase = "4964557aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const newerThanFix = "7c1de5bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

const closedBy = (number, test, pulls) => ({
  number,
  title: raceTitle(test),
  url: issueUrl(number),
  state: "CLOSED",
  closedByPullRequestsReferences: { nodes: pulls },
})
const merged = (number, mergeCommit, mergedAt) => ({
  number,
  state: "MERGED",
  mergedAt,
  mergeCommit: { oid: mergeCommit },
})
const fixedByPull = closedBy(1126, frameGroupMove, [merged(1136, fixMerge, "2026-11-20T16:40:07Z")])
const closedByHand = closedBy(1142, frameGroupMove, [])

const tracker = ({ open = [], closed = [], compared = {} }) => {
  const calls = []
  const gh = (args, input) => {
    calls.push({ args, input })
    const [first, second] = args
    if (first === "issue" && second === "list") return ok(JSON.stringify(open))
    if (first === "api" && second === "graphql") return ok(JSON.stringify({ data: { search: { nodes: closed } } }))
    if (first === "api" && second.startsWith(`repos/${repository}/compare/`)) {
      const answer = compared[second.split("...")[1]]
      return answer === undefined ? fail("gh: Not Found (HTTP 404)") : ok(`${answer}\n`)
    }
    if (first === "issue" && ["comment", "reopen"].includes(second)) return ok(`${issueUrl(args[2])}\n`)
    if (first === "issue" && second === "create") return ok(`${issueUrl(2000)}\n`)
    return fail(`unexpected gh ${args.join(" ")}`)
  }
  const did = () =>
    calls
      .filter((call) => !(call.args[0] === "issue" && call.args[1] === "list") && call.args[0] !== "api")
      .map((call) => (call.args[1] === "create" ? "issue create" : call.args.slice(0, 3).join(" ")))
  const compares = () => calls.filter((call) => call.args[1]?.startsWith(`repos/${repository}/compare/`))
  return { gh, calls, did, compares }
}
const ok = (stdout) => ({ status: 0, stdout, stderr: "" })
const fail = (stderr) => ({ status: 1, stdout: "", stderr })

const failure = (commit, extra = {}) => ({
  repository,
  test: frameGroupMove,
  excerpt: "Expected 120, received 80",
  commit,
  seen: "in ci run https://github.com/Rickvu309/AirDesign/actions/runs/77",
  ...extra,
})

const replayed = tracker({ closed: [closedByHand, fixedByPull], compared: { [oldBase]: "behind" } })
const stale = recordRace({ ...failure(oldBase), gh: replayed.gh })
same("a failure on a commit that lacks the fix files nothing and comments on the closed issue", replayed.did(), [
  "issue comment 1126",
])
same("the stale failure points at the fixed issue", stale, { url: issueUrl(1126) })
const staleComment = replayed.calls.find((call) => call.args[1] === "comment")
same(
  "the comment has no agent line, says the failure predates the fix and names the fix and the commit",
  [
    attributionLine(staleComment.input) === undefined,
    staleComment.input.includes("predates the fix"),
    staleComment.input.includes("1136"),
    staleComment.input.includes(fixMerge.slice(0, 7)),
    staleComment.input.includes(oldBase.slice(0, 7)),
    staleComment.input.includes("Expected 120, received 80"),
  ],
  [true, true, true, true, true, true],
)
same(
  "the compare asks whether the failing commit is ahead of the fix's merge commit",
  replayed.compares().map((call) => call.args[1]),
  [`repos/${repository}/compare/${fixMerge}...${oldBase}`],
)

const held = tracker({ closed: [fixedByPull], compared: { [newerThanFix]: "ahead" } })
const reopened = recordRace({ ...failure(newerThanFix), gh: held.gh })
same("a failure on a commit that has the fix reopens the closed issue and files nothing", held.did(), [
  "issue reopen 1126",
  "issue comment 1126",
])
same("the reopened issue is the result", reopened, { url: issueUrl(1126) })
const heldComment = held.calls.find((call) => call.args[1] === "comment")
same(
  "the reopen comment has no agent line, says the fix did not hold and carries the new evidence",
  [
    attributionLine(heldComment.input) === undefined,
    heldComment.input.includes("did not hold"),
    heldComment.input.includes("1136"),
    heldComment.input.includes(newerThanFix),
    heldComment.input.includes("Expected 120, received 80"),
  ],
  [true, true, true, true, true],
)

const exactFix = tracker({ closed: [fixedByPull], compared: { [fixMerge]: "identical" } })
recordRace({ ...failure(fixMerge), gh: exactFix.gh })
same("the fix's own merge commit contains the fix", exactFix.did(), ["issue reopen 1126", "issue comment 1126"])

const answers = (statuses) => (args) => ({ status: statuses[args.join(" ")] ?? 128, stdout: "", stderr: "" })
const askedGit = []
const local = tracker({ closed: [fixedByPull] })
recordRace({
  ...failure(oldBase),
  gh: local.gh,
  git: (args) => {
    askedGit.push(args)
    return answers({ [`merge-base --is-ancestor ${fixMerge} ${oldBase}`]: 1 })(args)
  },
})
same(
  "a commit git has is judged by git merge-base, not the compare API",
  [askedGit, local.compares().length, local.did()],
  [[["merge-base", "--is-ancestor", fixMerge, oldBase]], 0, ["issue comment 1126"]],
)
const localHeld = tracker({ closed: [fixedByPull] })
recordRace({
  ...failure(newerThanFix),
  gh: localHeld.gh,
  git: answers({ [`merge-base --is-ancestor ${fixMerge} ${newerThanFix}`]: 0 }),
})
same("git saying the fix is an ancestor reopens the issue", localHeld.did(), [
  "issue reopen 1126",
  "issue comment 1126",
])
const unpushed = tracker({ closed: [fixedByPull], compared: { [newerThanFix]: "ahead" } })
recordRace({ ...failure(newerThanFix), gh: unpushed.gh, git: answers({}) })
same(
  "a commit git does not have is judged by the compare API",
  [unpushed.compares().length, unpushed.did()],
  [1, ["issue reopen 1126", "issue comment 1126"]],
)

const diverged = tracker({ closed: [fixedByPull], compared: { [oldBase]: "diverged" } })
recordRace({ ...failure(oldBase), gh: diverged.gh })
same("a commit that diverged from the fix lacks it", diverged.did(), ["issue comment 1126"])

const unjudged = tracker({ closed: [fixedByPull] })
same(
  "a commit nobody can compare says why and changes no issue",
  [recordRace({ ...failure(oldBase), gh: unjudged.gh }), unjudged.did()],
  [{ why: `could not tell whether ${oldBase} has the fix in ${fixMerge}: gh: Not Found (HTTP 404)` }, []],
)

const openToo = tracker({
  open: [{ number: 1500, title: raceTitle(frameGroupMove), url: issueUrl(1500) }],
  closed: [fixedByPull],
})
recordRace({ ...failure(newerThanFix), gh: openToo.gh })
same(
  "an open issue for the test takes the comment, and the closed ones are not read",
  [openToo.did(), openToo.calls.some((call) => call.args[0] === "api")],
  [["issue comment 1500"], false],
)

const moved = tracker({
  closed: [{ ...fixedByPull, title: raceTitle({ ...frameGroupMove, line: 12 }) }],
  compared: { [oldBase]: "behind" },
})
recordRace({ ...failure(oldBase), gh: moved.gh })
same("a closed issue is found by file and title when the test moved lines", moved.did(), ["issue comment 1126"])

const otherTest = tracker({
  closed: [
    closedBy(1300, { ...frameGroupMove, name: "another test" }, [merged(1301, fixMerge, "2026-11-20T10:00:00Z")]),
  ],
})
same(
  "a closed issue for another test of the same file is not this test's",
  [recordRace({ ...failure(oldBase), gh: otherTest.gh }), otherTest.did()],
  [{ url: issueUrl(2000) }, ["issue create"]],
)

const byHand = tracker({ closed: [closedByHand] })
same(
  "a closed issue that no merged pull request closed files a new one",
  [recordRace({ ...failure(oldBase), gh: byHand.gh }), byHand.did()],
  [{ url: issueUrl(2000) }, ["issue create"]],
)

const unmerged = tracker({
  closed: [closedBy(1400, frameGroupMove, [{ number: 1401, state: "CLOSED", mergedAt: null, mergeCommit: null }])],
})
recordRace({ ...failure(oldBase), gh: unmerged.gh })
same("a closed pull request is not a fix", unmerged.did(), ["issue create"])

const twoFixes = tracker({
  closed: [fixedByPull, closedBy(1190, frameGroupMove, [merged(1191, newerThanFix, "2026-11-20T18:00:00Z")])],
  compared: { [oldBase]: "behind" },
})
recordRace({ ...failure(oldBase), gh: twoFixes.gh })
same(
  "with two fixed issues for one test, the later fix is the one judged",
  [twoFixes.compares().map((call) => call.args[1]), twoFixes.did()],
  [[`repos/${repository}/compare/${newerThanFix}...${oldBase}`], ["issue comment 1190"]],
)

const written = (track) => track.calls.filter((call) => call.args[0] === "issue" && call.input !== undefined)
const filed = tracker({})
recordRace({ ...failure(oldBase), gh: filed.gh })
same(
  "a new browser race issue points at the test's deck-state.json",
  written(filed).map((call) => call.input.includes(deckStateNote)),
  [true],
)
recordRace({ ...failure(newerThanFix), gh: openToo.gh })
same(
  "each comment on a browser race points at the run's deck-state.json",
  written(openToo).map((call) => call.input.includes(deckStateNote)),
  [true, true],
)
const unitRace = tracker({})
recordRace({ ...failure(oldBase), test: { file: "apps/web/src/deck-paint.test.ts", name: "paints" }, gh: unitRace.gh })
same(
  "a unit test race names no deck-state.json",
  written(unitRace).map((call) => call.input.includes(deckStateFile)),
  [false],
)

const zoomState = {
  file: "tests/browser/design-states.spec.ts",
  line: 73,
  name: "every named state of this design shard is reached and scanned in one stack",
  state: "zoom-selection",
}
same("a design-state race title names the state", raceTitle(zoomState), "Race: design-states › zoom-selection")
same(
  "a hand-filed design-state issue with a journey suffix shares the same race key",
  raceKey("Race: design-states › zoom-selection (navigate-zoom-pan)"),
  raceKey(raceTitle(zoomState)),
)
const designOpen = tracker({
  open: [
    {
      number: 1293,
      title: "Race: design-states › zoom-selection (navigate-zoom-pan)",
      url: issueUrl(1293),
    },
  ],
})
recordRace({ ...failure(oldBase), test: zoomState, gh: designOpen.gh })
same("a design-state race comments on an open issue for the same state", designOpen.did(), ["issue comment 1293"])

const designClosed = tracker({
  closed: [closedBy(1293, zoomState, [merged(1299, fixMerge, "2026-11-22T07:00:00Z")])],
  compared: { [oldBase]: "behind" },
})
recordRace({ ...failure(oldBase), test: zoomState, gh: designClosed.gh })
const designSearch = designClosed.calls.find((call) => call.args[1] === "graphql")?.args.at(-1) ?? ""
same(
  "closed design-state search queries design-states and the state name, not the spec path",
  [designSearch.includes('"design-states" "zoom-selection"'), designClosed.did()],
  [true, ["issue comment 1293"]],
)

console.log("race-issue tests passed")
