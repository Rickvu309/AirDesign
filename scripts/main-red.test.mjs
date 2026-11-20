import { fixture, ok, same } from "./land-harness.mjs"
import { jobKind, mainRedLine, mainsFault } from "./main-red.mjs"

const repository = "Rickvu309/AirDesign"
const greenBefore = {
  id: 43637141626,
  event: "push",
  branch: "main",
  head: "796b2454e796b2454e796b2454e796b2454e796b",
  conclusion: "success",
  createdAt: "2026-11-14T20:22:21Z",
  title: "Move slide backgrounds into fill rows on the Fill panel",
}
const redMain = {
  id: 43642103096,
  event: "push",
  branch: "main",
  head: "6a8db92839861a99e9dc6741b1e75f0760609419",
  conclusion: "failure",
  createdAt: "2026-11-14T21:18:23Z",
  title: "Let a person and an agent style lines and arrowheads",
}
const healed = {
  id: 43649053245,
  event: "push",
  branch: "main",
  head: "2abaf25632abaf25632abaf25632abaf25632aba",
  conclusion: "success",
  createdAt: "2026-11-14T22:37:18Z",
  title: "Paint a second undo or panel change without waiting",
}
const running = { ...healed, id: 43649000000, conclusion: null, createdAt: "2026-11-14T22:30:00Z" }

const samePull = {
  run: {
    id: 43643100126,
    event: "pull_request",
    head: "755f8c0f8ef93e7360e7d7c3d4084f6fdd99e492",
    createdAt: "2026-11-14T21:29:44Z",
  },
  jobs: [{ id: 132594787151, name: "check (side)", log: fixture("pr-same-as-main.log") }],
}
const ownPull = {
  run: {
    id: 43646212621,
    event: "pull_request",
    head: "b3b38bf6a372d21e58e93117836ce9bdabf886b3",
    createdAt: "2026-11-14T22:05:19Z",
  },
  jobs: [{ id: 132604473898, name: "check (side)", log: fixture("pr-own-failure.log") }],
}

const judge = async ({ pull, polls, reverts = [] }) => {
  const said = []
  const asked = []
  let clock = 0
  let at = 0
  const gh = (args) => {
    asked.push(args.join(" "))
    if (args[0] === "pr" && args[1] === "list") return ok(JSON.stringify(reverts))
    if (args[1].includes("/actions/workflows/ci.yml/runs?branch=main&event=push"))
      return ok(JSON.stringify(polls[Math.min(at++, polls.length - 1)]))
    if (args[1] === `repos/${repository}/actions/runs/${redMain.id}/jobs?per_page=100`)
      return ok(JSON.stringify([{ id: 132591711136, name: "check (side)" }]))
    if (args[1] === `repos/${repository}/actions/jobs/132591711136/logs`) return ok(fixture("main-red-line-style.log"))
    throw new Error(`unexpected gh ${args.join(" ")}`)
  }
  const verdict = await mainsFault({
    gh,
    repository,
    ...pull,
    say: (line) => said.push(line),
    sleep: (ms) => {
      clock += ms
    },
    now: () => clock,
    interval: 60000,
    limitMs: 3600000,
  })
  return { verdict, said, asked, waited: clock }
}

same(
  "a shard number is not part of the job",
  [jobKind("check (browser 2/4)"), jobKind("corpus (1/2)"), jobKind("check (side)")],
  ["check (browser)", "corpus", "check (side)"],
)

const replay = await judge({
  pull: samePull,
  polls: [
    [redMain, greenBefore],
    [running, redMain, greenBefore],
    [healed, redMain, greenBefore],
  ],
})
same(
  "the replay of run 43643100126, failing only the job and test main failed on, is main's fault",
  replay.verdict.mains,
  true,
)
same(
  "land says plainly that main is red, since which commit, and in which job",
  replay.said[0],
  "follow: main is red since 6a8db928 (Let a person and an agent style lines and arrowheads), not your change: check (side)",
)
same(
  "it names the shared test",
  replay.said.some((line) => line.includes("tests/browser/line-style.spec.ts › a person widens and dashes a line")),
  true,
)
same(
  "it never tells the agent to fix the error in its own pull request",
  replay.said.some((line) => /fix the (test|code)|fix the failure/i.test(line)),
  false,
)
same("it waits for main to go green, polling at the interval", replay.waited, 120000)
same("and continues once a push run on main passes", replay.verdict.healer.head, healed.head)
same("and says main is green again", replay.said.at(-1).includes("main is green again at 2abaf256"), true)

const own = await judge({ pull: ownPull, polls: [[redMain, greenBefore]] })
same(
  "run 43646212621 failed main's test and one of its own, so the failure stays the pull request's",
  own.verdict.mains,
  false,
)
same("and nothing about main is said or waited on", [own.said, own.waited], [[], 0])

const greenNow = await judge({ pull: samePull, polls: [[healed, redMain, greenBefore]] })
same(
  "main went green after the pull request's run started: still main's, and no wait",
  [greenNow.verdict.mains, greenNow.waited],
  [true, 0],
)
same(
  "it says main was red and is green again",
  greenNow.said.some((line) => line.includes("main is green again at 2abaf256")),
  true,
)

const after = await judge({
  pull: { ...samePull, run: { ...samePull.run, createdAt: "2026-11-14T23:00:00Z" } },
  polls: [[healed, redMain, greenBefore]],
})
same("a run that started after main went green again is the pull request's own", after.verdict.mains, false)

const before = await judge({
  pull: { ...samePull, run: { ...samePull.run, createdAt: "2026-11-14T21:00:00Z" } },
  polls: [[redMain, greenBefore]],
})
same("a run that started before main went red is the pull request's own", before.verdict.mains, false)

const reverted = await judge({
  pull: samePull,
  polls: [
    [redMain, greenBefore],
    [healed, redMain, greenBefore],
  ],
  reverts: [
    {
      number: 520,
      title: 'Revert "Let a person and an agent style lines and arrowheads"',
      url: "https://github.com/Rickvu309/AirDesign/pull/520",
    },
  ],
})
same(
  "an open revert of the first red commit is named as what land waits for",
  reverted.said.some(
    (line) => line.includes("revert") && line.includes("https://github.com/Rickvu309/AirDesign/pull/520"),
  ),
  true,
)
same(
  "the revert is found by the first red commit",
  reverted.asked.some((line) => line.startsWith("pr list") && line.includes(redMain.head)),
  true,
)

const stuck = await judge({ pull: samePull, polls: [[redMain, greenBefore]] })
same(
  "a main that stays red stops the wait at the limit",
  [stuck.verdict.mains, stuck.verdict.healer],
  [true, undefined],
)
same(
  "and says so without blaming the change",
  stuck.said.at(-1).includes("still red after 60 minutes") && !stuck.said.at(-1).includes("fix"),
  true,
)

const line = (polls) => {
  let at = 0
  return mainRedLine({
    repository,
    gh: (args) =>
      args[1].includes("/runs/43642103096/jobs")
        ? ok(JSON.stringify([{ id: 132591711136, name: "check (side)" }]))
        : ok(JSON.stringify(polls[Math.min(at++, polls.length - 1)])),
  })
}
same(
  "when main's latest push run is red, the follow starts by saying so",
  line([[redMain, greenBefore]]),
  "main is red since 6a8db928 (Let a person and an agent style lines and arrowheads): check (side). A failure here that matches it is main's, not this change's.",
)
same("when main is green, nothing is said", line([[healed, redMain]]), undefined)
