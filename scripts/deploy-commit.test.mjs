import { chooseDeploy, greenPushArgs, latestConclusions, pushGreen, versionLive, versionOf } from "./deploy-commit.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const live = "aafecf80470182f85f59b888576180f6d8986cb8"
const older = "15a9fb350106d53f74039511ef491e1a76e7c4b2"
const parent = "0d318ba4b305e9f74291cbbd98c0811ccc347735"
const red = "ec82581b004ee250af756c938d00ce55822a3500"
const failedDeploy = "475bfffe19687933e81c90c9dd2b6d214281f955"
const duringBurst = "03e0927aa1daa78507db3ec1e5845cf4be8be411"
const pendingMid = "bfb5e0ead300da5381bfb2b2ab3a184e05862fc8"
const pendingTip = "3b5d2b2bf8acba308785790572b7ec41323a6ee1"
const layouts = "5c7262c7ee8f57916216482fd29ddaa7a50b1b75"
const exportCost = "6a7fe6473febeef400d815d9219d1834a81d9c71"
const plainText = "cfb2b2e88121bde93ed67bb490e71cdeb2d58f75"
const buildOrder = "97220351df586cd2dd07a4e7f7c208387a969d03"
const settled = "1c3268d28c6b65651b4b41eae922ebb565360ac1"

const ciOf = (rows) => Object.fromEntries(rows)

same(
  "a burst where the tip moved deploys the newest green commit",
  chooseDeploy({
    commits: [pendingTip, pendingMid, duringBurst, failedDeploy, red, parent, older, live],
    ci: ciOf([
      [pendingTip, "pending"],
      [pendingMid, "pending"],
      [duringBurst, "success"],
      [failedDeploy, "success"],
      [red, "failure"],
      [parent, "success"],
      [older, "success"],
      [live, "success"],
    ]),
    live,
  }),
  { deploy: true, sha: duringBurst },
)

same(
  "a late run for an older commit does not step production back",
  chooseDeploy({
    commits: [settled, buildOrder, older],
    ci: ciOf([
      [settled, "success"],
      [buildOrder, "success"],
      [older, "success"],
    ]),
    live: settled,
  }),
  { deploy: false, reason: "served", sha: settled },
)

same(
  "a red tip deploys its green parent",
  chooseDeploy({
    commits: [red, parent, older, live],
    ci: ciOf([
      [red, "failure"],
      [parent, "success"],
      [older, "success"],
      [live, "success"],
    ]),
    live,
  }),
  { deploy: true, sha: parent },
)

same(
  "an app that already serves N skips",
  chooseDeploy({ commits: [settled], ci: { [settled]: "success" }, live: settled }),
  { deploy: false, reason: "served", sha: settled },
)

same(
  "an app that already serves a newer commit containing N skips",
  chooseDeploy({
    commits: [buildOrder, settled],
    ci: ciOf([
      [buildOrder, "pending"],
      [settled, "success"],
    ]),
    live: buildOrder,
  }),
  { deploy: false, reason: "served", sha: settled },
)

const table = [
  [settled, "success"],
  [buildOrder, "success"],
  [plainText, "success"],
  [exportCost, "success"],
  [layouts, "success"],
  [pendingTip, "success"],
  [pendingMid, "success"],
  [duringBurst, "success"],
  [failedDeploy, "success"],
  [red, "failure"],
  [parent, "success"],
  [older, "success"],
  [live, "success"],
]
same(
  "the 21 November burst deploys the newest green commit while the web app is still on the previous one",
  chooseDeploy({ commits: table.map(([sha]) => sha), ci: ciOf(table), live }),
  { deploy: true, sha: settled },
)

same(
  "a later failure replaces an earlier success for the same commit",
  latestConclusions([
    { id: 1, sha: red, conclusion: "success", event: "push", branch: "main" },
    { id: 2, sha: red, conclusion: "failure", event: "push", branch: "main" },
  ]),
  { [red]: "failure" },
)
same(
  "a pull request run does not make a commit green",
  latestConclusions([{ id: 3, sha: red, conclusion: "success", event: "pull_request", branch: "main" }]),
  {},
)

const pushed = "c".repeat(40)
same("green is a fast-forward push and never a force", greenPushArgs(pushed).includes("--force"), false)
same("green is updated to N", greenPushArgs(pushed), ["push", "origin", `${pushed}:refs/heads/green`])

const calls = []
const git = (args) => {
  calls.push(args.join(" "))
  if (args[0] === "push") return { status: 1, stdout: "" }
  if (args[0] === "merge-base") return { status: args.at(-1) === "origin/green" ? 0 : 1, stdout: "" }
  return { status: 0, stdout: "" }
}
same("a green branch already ahead of N stays there", pushGreen(git, pushed), { ok: true, ahead: true })
same(
  "the rejected push is checked against the remote branch",
  calls.includes(`merge-base --is-ancestor ${pushed} origin/green`),
  true,
)

const stuck = []
same(
  "a rejected push that is not ahead fails",
  pushGreen((args) => {
    stuck.push(args[0])
    return { status: 1, stdout: "" }
  }, pushed).ok,
  false,
)

same(
  "the web app and the API publish their own versions",
  [versionOf.web, versionOf.api],
  ["https://studio.airdesign.app", "https://api-production-f919c062.up.railway.app"],
)
same("a version that does not answer is an error", versionLive({ status: 0 }), { error: "no answer" })
same("a missing version is not a commit", versionLive({ status: 404 }), {})
same("a version names the commit it serves", versionLive({ status: 200, json: { commit: settled } }), { live: settled })

console.log("deploy-commit tests passed")
