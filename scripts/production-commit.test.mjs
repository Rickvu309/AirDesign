import { versionOf } from "./deploy-commit.mjs"
import { deployedCommit, parseWait } from "./production-commit.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const older = "a".repeat(40)
const wanted = "b".repeat(40)
const newer = "c".repeat(40)
const origin = "https://api.example"

const production = ({ answers, contains = [] }) => {
  let clock = 0
  const asked = []
  const waits = []
  const read = async (url) => {
    asked.push(url)
    const answer = answers[Math.min(asked.length - 1, answers.length - 1)]
    return answer === undefined ? { status: 0, json: undefined } : { status: 200, json: { commit: answer } }
  }
  const git = (args) => {
    if (args[0] === "fetch") return { status: 0, stdout: "" }
    if (args[0] === "cat-file") return { status: [older, wanted, newer].some((sha) => args[2].startsWith(sha)) ? 0 : 1 }
    if (args[0] === "merge-base") return { status: contains.includes(args[3]) ? 0 : 1 }
    throw new Error(`unexpected git ${args.join(" ")}`)
  }
  const wait = async (ms) => {
    waits.push(ms)
    clock += ms
  }
  const now = () => clock
  return { read, git, wait, now, asked, waits }
}

const reached = production({ answers: [older, older, wanted] })
same("the deployed commit passes once production serves it", await deployedCommit({ origin, wanted, ...reached }), {
  ok: true,
  line: `production API serves ${wanted.slice(0, 12)}, which contains ${wanted.slice(0, 12)}`,
})
same("it asks the API's version", reached.asked[0], `${origin}/version`)
same("it waits twenty seconds between asks", reached.waits, [20_000, 20_000])

const moved = production({ answers: [newer], contains: [newer] })
same(
  "a newer commit that contains the deployed one passes",
  (await deployedCommit({ origin, wanted, ...moved })).ok,
  true,
)

const unreachable = production({ answers: [undefined, wanted] })
same(
  "an API that does not answer yet is asked again",
  (await deployedCommit({ origin, wanted, ...unreachable })).ok,
  true,
)

const stuck = production({ answers: [older] })
same(
  "production still at an older commit after fifteen minutes fails and names both commits",
  await deployedCommit({ origin, wanted, ...stuck }),
  { ok: false, line: `production API still at ${older}, wanted ${wanted}` },
)
same(
  "it gives up after fifteen minutes",
  stuck.waits.reduce((sum, ms) => sum + ms, 0),
  15 * 60_000,
)

const silent = production({ answers: [undefined] })
same(
  "an API that never answers fails",
  (await deployedCommit({ origin, wanted, ...silent })).line,
  `production API still at no commit, wanted ${wanted}`,
)

const both = production({ answers: [older, wanted] })
same(
  "the web app and the API must both serve the commit before the wait ends",
  await deployedCommit({
    origins: [
      { origin: "https://studio.example", label: "web app" },
      { origin, label: "production API" },
    ],
    wanted,
    ...both,
  }),
  {
    ok: true,
    line: `web app serves ${wanted.slice(0, 12)}, which contains ${wanted.slice(0, 12)}; production API serves ${wanted.slice(0, 12)}, which contains ${wanted.slice(0, 12)}`,
  },
)
same("it asks each app once per round", both.asked.slice(0, 2), ["https://studio.example/version", `${origin}/version`])
same("one round waits once, for every app", both.waits, [20_000])

same("a journey wait names the web app and the API", parseWait([wanted, "web", "api"]), {
  wanted,
  targets: [
    { origin: versionOf.web, label: "web app" },
    { origin: versionOf.api, label: "production API" },
  ],
})
same("the old one-origin form still names the API", parseWait([`${origin}/`, wanted]), {
  wanted,
  targets: [{ origin, label: "production API" }],
})

console.log("production-commit tests passed")
