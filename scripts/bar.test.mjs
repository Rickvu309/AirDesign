import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  contents,
  listedFiles,
  localFork,
  metricsFrom,
  newPackageFile,
  oldMetricNames,
  oldMetricsFile,
  onlyAddsReferences,
  ownerReasons,
  packageFile,
  readLocal,
  readReasons,
  sameButReferences,
  labelsFor,
  verdict,
} from "./bar.mjs"
import { workingTree } from "./checked.mjs"

const metrics = {
  "known-failures": { goal: 0 },
  "checked-contracts": { now: 2, goal: 20 },
  "ci-duration": { limit: 40 },
}
const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const texts = (change) =>
  ownerReasons({ baseMetrics: metrics, headMetrics: metrics, changedFiles: [], changedScripts: [], ...change }).map(
    (reason) => reason.text,
  )
const withMetric = (name, value) => ({ headMetrics: { ...metrics, [name]: value } })
const decks = "checked-contracts"

same("product code alone needs nobody", texts({ changedFiles: ["packages/render/src/slide-route.ts"] }), [])
same("a pull that changes no metric needs nobody", texts({}), [])
same("a deck added needs nobody", texts(withMetric(decks, { now: 3, goal: 20 })), [])
same("a tighter limit needs nobody", texts(withMetric("ci-duration", { limit: 30 })), [])
same("a new metric needs nobody", texts(withMetric("new one", { now: 9, goal: 0 })), [])
same("a stored count for a measured metric needs the owner", texts(withMetric("known-failures", { now: 3, goal: 0 })), [
  "The metric known-failures is measured on each run, so it must be only a goal, as a number.",
])
same("a deck dropped needs the owner", texts(withMetric(decks, { now: 1, goal: 20 })), [
  `${decks} went from 2 to 1, away from its goal of 20.`,
])
same("a count that jumps past its goal needs the owner", texts(withMetric(decks, { now: 38, goal: 20 })), [
  `${decks} went from 2 to 38, away from its goal of 20.`,
])
same("a looser limit needs the owner", texts(withMetric("ci-duration", { limit: 60 })), [
  "The limit of ci-duration went from 40 to 60.",
])
same("a moved goal needs the owner", texts(withMetric("known-failures", { goal: 5 })), [
  "The goal of known-failures went from 0 to 5.",
])
same("a limit turned into a count needs the owner", texts(withMetric("ci-duration", { now: 1, goal: 0 })), [
  "The metric ci-duration stopped being a limit.",
])
same("a removed metric needs the owner", texts({ headMetrics: { ...metrics, "known-failures": undefined } }), [
  "The metric known-failures was removed.",
])
const measuredShape = "The metric known-failures is measured on each run, so it must be only a goal, as a number."
for (const loose of [
  { limit: "9" },
  { limit: null },
  { limit: [39] },
  { now: null, goal: 0 },
  { now: "0", goal: 0 },
  { goal: "0" },
  { goal: null },
  { goal: 0, limit: 5 },
  {},
  7,
  null,
]) {
  same(
    `a measured metric shaped ${JSON.stringify(loose)} needs the owner`,
    texts(withMetric("known-failures", loose)),
    [measuredShape],
  )
}
same("a malformed new metric needs the owner", texts(withMetric("new one", { now: [] })).length, 1)

same(
  "package files are found",
  ["package.json", "packages/render/package.json", "apps/web/src/package.json.ts"].map(packageFile),
  [true, true, false],
)
same("changed scripts need the owner", texts({ changedScripts: ["package.json"] }), [
  "The scripts in package.json changed, and they are what ci runs.",
])

same("a measured metric with a limit needs the owner", texts(withMetric("known-failures", { goal: 0, limit: 5 })), [
  measuredShape,
])

same(
  "a path cannot smuggle a query into the address",
  contents("o/r", "abc", "apps/a#b/c?d e.json"),
  "repos/o/r/contents/apps/a%23b/c%3Fd%20e.json?ref=abc",
)

const generatedConfig = {
  extends: "../../tsconfig.base.json",
  compilerOptions: { composite: true, types: [] },
  include: ["src"],
}
same(
  "a new package config like the model, plus references, is the generator's",
  sameButReferences({ ...generatedConfig, references: [{ path: "../document" }] }, generatedConfig),
  true,
)
same(
  "a new package config with a looser option is not",
  sameButReferences(
    { ...generatedConfig, compilerOptions: { composite: true, types: [], strict: false } },
    generatedConfig,
  ),
  false,
)
same("a config that cannot be read is not", sameButReferences(undefined, generatedConfig), false)
const rootConfig = { files: [], references: [{ path: "./packages/doom" }] }
same(
  "the root config may gain a package",
  onlyAddsReferences(rootConfig, { files: [], references: [...rootConfig.references, { path: "./packages/catalog" }] }),
  true,
)
same(
  "the root config may not lose a package",
  onlyAddsReferences(rootConfig, { files: [], references: [{ path: "./packages/catalog" }] }),
  false,
)
same(
  "the root config may not change anything else",
  onlyAddsReferences(rootConfig, { files: [], references: rootConfig.references, compilerOptions: { strict: false } }),
  false,
)
same(
  "only an added file directly inside a package counts as new",
  [
    { name: "packages/catalog/tsconfig.json", status: "added" },
    { name: "packages/doom/tsconfig.json", status: "modified" },
    { name: "packages/catalog/deep/tsconfig.json", status: "added" },
    { name: "apps/web/tsconfig.json", status: "added" },
  ].map((file) => newPackageFile(file, "tsconfig.json")),
  [true, false, false, false],
)

const lowersOf = (change) =>
  ownerReasons({ baseMetrics: metrics, headMetrics: metrics, changedFiles: [], changedScripts: [], ...change }).map(
    (reason) => reason.lowers,
  )
same("a raised limit lowers the bar", lowersOf(withMetric("ci-duration", { limit: 60 })), [true])
same("a dropped contract count lowers the bar", lowersOf(withMetric(decks, { now: 1, goal: 20 })), [true])
same("a moved goal lowers the bar", lowersOf(withMetric("known-failures", { goal: 5 })), [true])
same("a measured fault is not in metrics.json, so it lowers nothing", lowersOf({}), [])
same("a changed check file is only listed", lowersOf({ changedFiles: ["scripts/check.mjs"] }), [false])
same("changed scripts are only listed", lowersOf({ changedScripts: ["package.json"] }), [false])

const listedOnly = verdict({
  reasons: [{ about: "file AGENTS.md", text: "AGENTS.md decides what ci checks.", lowers: false }],
})
same("a pull that only touches the checks is listed", [listedOnly.listed, listedOnly.lowers], [true, false])
same("its line names the owner and no account", listedOnly.lines, [
  "Listed for the owner: AGENTS.md decides what ci checks.",
])
const untouched = verdict({ reasons: [] })
same("a pull that touches nothing is not listed", [untouched.listed, untouched.lowers], [false, false])
const lowering = verdict({
  reasons: [
    { about: "metric ci-duration", text: "The limit of ci-duration went from 40 to 60.", lowers: true },
    { about: "file AGENTS.md", text: "AGENTS.md decides what ci checks.", lowers: false },
  ],
})
same("a pull that lowers the bar is listed as lowering it", [lowering.listed, lowering.lowers], [true, true])
same("what lowers the bar comes first and nothing asks for an approval", lowering.lines, [
  "Lowers the bar: The limit of ci-duration went from 40 to 60.",
  "Listed for the owner: AGENTS.md decides what ci checks.",
])
same("no verdict stops a pull request", "pass" in lowering, false)
same(
  "each label follows its verdict",
  [labelsFor(untouched), labelsFor(listedOnly), labelsFor(lowering)],
  [[], ["changes-ci"], ["changes-ci", "lowers-the-bar"]],
)

const routes = "export-coverage"
const withRoutes = (base, head) =>
  ownerReasons({
    baseMetrics: { [routes]: base },
    headMetrics: { [routes]: head },
    changedFiles: [],
    changedScripts: [],
  }).map((reason) => reason.text)
same(
  "a goal that moves further ahead is a higher bar and needs nobody",
  withRoutes({ now: 17, goal: 50 }, { now: 17, goal: 53 }),
  [],
)
same(
  "a higher bar with progress in the same change needs nobody",
  withRoutes({ now: 17, goal: 50 }, { now: 19, goal: 53 }),
  [],
)
same("a higher bar does not excuse a count that fell", withRoutes({ now: 17, goal: 50 }, { now: 15, goal: 53 }), [
  `${routes} went from 17 to 15, away from its goal of 50.`,
])
same("a goal that moves closer is a lower bar", withRoutes({ now: 17, goal: 50 }, { now: 17, goal: 40 }), [
  `The goal of ${routes} went from 50 to 40.`,
])
same(
  "for a count that should fall, a goal further down is a higher bar",
  withRoutes({ now: 6, goal: 3, better: "lower" }, { now: 6, goal: 0, better: "lower" }),
  [],
)
same(
  "for a count that should fall, a goal further up is a lower bar",
  withRoutes({ now: 6, goal: 3, better: "lower" }, { now: 6, goal: 5, better: "lower" }),
  [`The goal of ${routes} went from 3 to 5.`],
)
same(
  "a goal that moves when the count already met it needs the owner",
  withRoutes({ now: 4, goal: 4 }, { now: 4, goal: 9 }),
  [`The goal of ${routes} went from 4 to 9.`],
)

const renamed = {
  "known-failures": { goal: 0 },
  "ci-duration": { limit: 40 },
}
const oldFile = Object.fromEntries(Object.entries(oldMetricNames).map(([old, name]) => [old, renamed[name]]))
const atMergeBase = metricsFrom((file) => (file === oldMetricsFile ? oldFile : undefined))
const atHead = metricsFrom((file) => (file === "metrics.json" ? renamed : undefined))
same("the old file at the merge base reads under the new names", atMergeBase, renamed)
same(
  "the old file at the merge base and the same values at the head need nobody",
  ownerReasons({ baseMetrics: atMergeBase, headMetrics: atHead, changedFiles: [], changedScripts: [] }),
  [],
)
same(
  "the new file wins when both exist",
  metricsFrom((file) => (file === "metrics.json" ? renamed : oldFile)),
  renamed,
)
same(
  "no file at a commit reads as absent",
  metricsFrom(() => undefined),
  undefined,
)
same(
  "a name the old file added itself is kept",
  metricsFrom((file) => (file === oldMetricsFile ? { "new one": { limit: 1 } } : undefined)),
  { "new one": { limit: 1 } },
)

same(
  "git's name-status reads as the files a pull request lists",
  listedFiles("M\0metrics.json\0R087\0scripts/a.test.mjs\0scripts/a.mjs\0D\0tests/gone.test.ts\0A\0new.ts\0"),
  [
    { name: "metrics.json", status: "modified" },
    { name: "scripts/a.mjs", before: "scripts/a.test.mjs", status: "renamed" },
    { name: "tests/gone.test.ts", status: "removed" },
    { name: "new.ts", status: "added" },
  ],
)
same(
  "a test file split into two and removed needs nobody",
  readReasons({
    text: (sha, file) => (file === "metrics.json" ? JSON.stringify({ "ci-duration": { limit: 40 } }) : undefined),
    fork: "fork",
    head: "head",
    listed: [
      { name: "packages/live/src/live.test.ts", status: "removed" },
      { name: "packages/live/src/cache.test.ts", status: "added" },
      { name: "packages/live/src/remote.test.ts", status: "added" },
    ],
  }),
  [],
)
same(
  "the reasons read through any reader",
  readReasons({
    text: (sha, file) =>
      file === "metrics.json" ? JSON.stringify({ "ci-duration": { limit: sha === "fork" ? 40 : 45 } }) : undefined,
    fork: "fork",
    head: "head",
    listed: [{ name: "metrics.json", status: "modified" }],
  }).map((reason) => reason.text),
  ["The limit of ci-duration went from 40 to 45."],
)

same(
  "a renamed test file that GitHub lists with a null patch reads as unchanged",
  readReasons({
    text: (sha, file) =>
      file === "metrics.json" ? JSON.stringify({ "ci-duration": { limit: 40 } }) : 'it("a", () => {})\n',
    fork: "fork",
    head: "head",
    listed: [
      {
        name: "apps/web/src/editor/a.test.ts",
        before: "apps/web/src/scene-editor/a.test.ts",
        status: "renamed",
        patch: null,
      },
    ],
  }),
  [],
)

const localRepo = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-bar-local-"))
process.on("exit", () => fs.rmSync(localRepo, { recursive: true, force: true }))
const localGit = (args, input) =>
  execFileSync("git", ["-C", localRepo, ...args], {
    encoding: "utf8",
    input,
    stdio: ["pipe", "pipe", "pipe"],
  }).trim()
const localFile = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(localRepo, file)), { recursive: true })
  fs.writeFileSync(path.join(localRepo, file), text)
}
localGit(["init", "--quiet"])
same(
  "a clone with no origin/main passes and says why",
  localFork(localRepo).why,
  "There is no origin/main here, so this branch cannot be judged locally. CI judges it.",
)
localFile(
  "metrics.json",
  JSON.stringify({
    "ci-duration": { limit: 40 },
    "checked-contracts": { now: 2, goal: 20 },
    "known-failures": { goal: 0 },
  }),
)
localFile("packages/render/src/route.test.ts", "case\n")
localGit(["add", "--all"])
const stamp = "proof <proof@example.com> 0 +0000"
const mainCommit = localGit(
  ["hash-object", "-t", "commit", "-w", "--stdin"],
  `tree ${localGit(["write-tree"])}\nauthor ${stamp}\ncommitter ${stamp}\n\nmain\n`,
)
localGit(["update-ref", "refs/remotes/origin/main", mainCommit])
localGit(["update-ref", "HEAD", mainCommit])
localGit(["remote", "add", "origin", "https://github.com/Rickvu309/AirDesign.git"])
same("an untouched branch forks where main is", localFork(localRepo).fork, mainCommit)
same("an untouched branch touches nothing", verdict(readLocal(localRepo)).lines, ["Nothing here touches the bar."])
localFile(
  "metrics.json",
  JSON.stringify({
    "ci-duration": { limit: 50 },
    "checked-contracts": { now: 1, goal: 20 },
    "known-failures": { goal: 0 },
  }),
)
fs.rmSync(path.join(localRepo, "packages/render/src/route.test.ts"))
localFile("scripts/new-check.mjs", "check\n")
const localVerdict = verdict(readLocal(localRepo))
same("a lowered bar in the working tree is seen locally", localVerdict.lowers, true)
same("the local verdict says what ci says", localVerdict.lines, [
  "Lowers the bar: The limit of ci-duration went from 40 to 50.",
  "Lowers the bar: checked-contracts went from 2 to 1, away from its goal of 20.",
  "Listed for the owner: scripts/new-check.mjs decides what ci checks.",
])
const localStep = () => {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, ["scripts/bar.mjs", "local", localRepo], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    }
  } catch (error) {
    return { status: error.status, output: `${error.stdout}${error.stderr}` }
  }
}
same("locally a lowered bar prints what ci says and passes", localStep(), {
  status: 0,
  output: [...localVerdict.lines, ""].join("\n"),
})
same("reading the working tree leaves the index alone", localGit(["diff", "--cached", "--name-only"]), "")
same("the working tree is read with what is not staged", workingTree(localRepo) === localGit(["write-tree"]), false)

console.log("bar tests passed")
