import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  approvedCommit,
  contents,
  guarded,
  lostCases,
  listedFiles,
  localFork,
  localWarning,
  lostKinds,
  metricsFrom,
  newPackageFile,
  oldMetricNames,
  oldMetricsFile,
  onlyAddsReferences,
  ownerOf,
  ownerReasons,
  packageFile,
  readLocal,
  readReasons,
  removedTestFiles,
  replacedFixtures,
  sameButReferences,
  verdict,
} from "./ratchet.mjs"
import { workingTree } from "./checked.mjs"

const metrics = {
  "known-failures": { now: 2, goal: 0 },
  "corpus-size": { now: 2, goal: 20 },
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
const decks = "corpus-size"

same("product code alone needs nobody", texts({ changedFiles: ["packages/pptx/src/slide-route.ts"] }), [])
same("a fixed fault needs nobody", texts(withMetric("known-failures", { now: 1, goal: 0 })), [])
same("a deck added needs nobody", texts(withMetric(decks, { now: 3, goal: 20 })), [])
same("a tighter limit needs nobody", texts(withMetric("ci-duration", { limit: 30 })), [])
same("a new metric needs nobody", texts(withMetric("new one", { now: 9, goal: 0 })), [])
same("a new floor needs nobody", texts(withMetric("test-count", { floor: 9 })), [])
same(
  "a higher floor needs nobody",
  texts({
    baseMetrics: { ...metrics, "test-count": { floor: 10 } },
    headMetrics: { ...metrics, "test-count": { floor: 11 } },
  }),
  [],
)
same(
  "a lower floor needs the owner",
  texts({
    baseMetrics: { ...metrics, "test-count": { floor: 10 } },
    headMetrics: { ...metrics, "test-count": { floor: 9 } },
  }),
  ["The floor of test-count went from 10 to 9."],
)
same(
  "a floor turned into a count needs the owner",
  texts({
    baseMetrics: { ...metrics, "test-count": { floor: 10 } },
    headMetrics: { ...metrics, "test-count": { now: 10, goal: 10 } },
  }),
  ["The metric test-count stopped being a floor."],
)
same("a new fault needs the owner", texts(withMetric("known-failures", { now: 3, goal: 0 })), [
  "known-failures went from 2 to 3, away from its goal of 0.",
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
same("a moved goal needs the owner", texts(withMetric("known-failures", { now: 2, goal: 5 })), [
  "The goal of known-failures went from 0 to 5.",
])
same("a limit turned into a count needs the owner", texts(withMetric("ci-duration", { now: 1, goal: 0 })), [
  "The metric ci-duration stopped being a limit.",
])
same(
  "a removed metric needs the owner",
  texts({ headMetrics: { "known-failures": metrics["known-failures"] } }).length,
  2,
)
for (const loose of [
  { limit: "9" },
  { limit: null },
  { limit: [39] },
  { now: null, goal: 0 },
  { now: "0", goal: 0 },
  7,
  null,
]) {
  same(`a metric shaped ${JSON.stringify(loose)} needs the owner`, texts(withMetric("known-failures", loose)), [
    "The metric known-failures must be only a limit, or only now and goal, or only a floor, as numbers.",
  ])
}
same("a malformed new metric needs the owner", texts(withMetric("new one", { now: [] })).length, 1)

for (const file of [
  ".github/workflows/ci.yml",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.js",
  "AGENTS.md",
  "scripts/metrics.mjs",
  "scripts/pptx-check.mjs",
  "scripts/pptx-tools.sh",
  "scripts/pptx-judge/Program.cs",
  "tsconfig.base.json",
  "packages/pptx/tsconfig.json",
  "apps/web/.oxlintrc.json",
  ".oxfmtrc.json",
  "pnpm-workspace.yaml",
  "vitest.config.mts",
  "apps/web/vitest.config.ts",
  "playwright.config.ts",
  ".npmrc",
  "specs/edit/Edit.cfg",
  "vitest.workspace.ts",
]) {
  if (!guarded(file)) throw new Error(`${file} decides ci and is not guarded`)
}
for (const file of [
  "apps/web/src/App.tsx",
  "packages/pptx/src/slide-route.ts",
  "scripts/pptx-fixtures/cases.json",
  "metrics.json",
]) {
  if (guarded(file)) throw new Error(`${file} is product or data and is guarded`)
}
same(
  "package files are found",
  ["package.json", "packages/pptx/package.json", "apps/web/src/package.json.ts"].map(packageFile),
  [true, true, false],
)
same("changed scripts need the owner", texts({ changedScripts: ["package.json"] }), [
  "The scripts in package.json changed, and they are what ci runs.",
])

same(
  "a count given a limit as well needs the owner",
  texts(withMetric("known-failures", { now: 2, goal: 0, limit: 5 })),
  ["The metric known-failures must be only a limit, or only now and goal, or only a floor, as numbers."],
)
same("a count turned into a limit needs the owner", texts(withMetric("known-failures", { limit: 5 })), [
  "The metric known-failures stopped being a count with a goal.",
])

const cases = [
  { name: "text-page", errors: 0 },
  { name: "child-order", errors: 1 },
]
same("an added case needs nobody", lostCases(cases, [...cases, { name: "new", errors: 0 }]), [])
same("a changed expectation is named", lostCases(cases, [{ name: "text-page", errors: 3 }, cases[1]]), ["text-page"])
same("a removed case is named", lostCases(cases, [cases[0]]), ["child-order"])
same("a changed case needs the owner", texts({ changedCases: ["text-page"] }), [
  "The PowerPoint case text-page was changed or removed.",
])

const proof = { "duplicate shape id": "caught", "chart data-label range": "missed" }
same("an unchanged proof needs nobody", lostKinds(proof, proof), [])
same("a new kind needs nobody", lostKinds(proof, { ...proof, "new caught": "caught", "new missed": "missed" }), [])
same("a kind now caught needs nobody", lostKinds(proof, { ...proof, "chart data-label range": "caught" }), [])
same("a kind no longer caught is named", lostKinds(proof, { ...proof, "duplicate shape id": "missed" }), [
  "duplicate shape id",
])
same(
  "a removed kind is named, caught or missed, so dropping a miss cannot flatter the count",
  lostKinds(proof, { "another kind": "caught" }),
  ["duplicate shape id", "chart data-label range"],
)
same("dropping only the missed kind is named", lostKinds(proof, { "duplicate shape id": "caught" }), [
  "chart data-label range",
])
same(
  "one kind gained does not hide one lost",
  lostKinds(proof, { "duplicate shape id": "missed", "chart data-label range": "caught" }),
  ["duplicate shape id"],
)
same("a lost kind needs the owner", texts({ changedKinds: ["duplicate shape id"] }), [
  "The judge proof no longer records duplicate shape id as caught.",
])
const caughtMetric = "fault-detection"
const proofMetrics = { baseMetrics: { ...metrics, [caughtMetric]: { now: 9, goal: 10 } } }
same(
  "a new kind moves the count of caught kinds and its goal freely",
  texts({ ...proofMetrics, headMetrics: { ...metrics, [caughtMetric]: { now: 9, goal: 11 } } }),
  [],
)
same("the count of caught kinds cannot be removed", texts({ ...proofMetrics, headMetrics: metrics }), [
  `The metric ${caughtMetric} was removed.`,
])

const deck = "scripts/pptx-fixtures/nasa-1d-cnn.pptx"
same(
  "a deck already judged that is swapped, removed or moved is named, and a new one is not",
  replacedFixtures([
    { name: deck, status: "modified" },
    { name: "scripts/pptx-fixtures/text.pptx", status: "removed" },
    { name: "apps/web/moved.pptx", before: "scripts/pptx-fixtures/clean.pptx", status: "renamed" },
    { name: "scripts/pptx-fixtures/new-deck.pptx", status: "added" },
    { name: "scripts/pptx-fixtures/cases.json", status: "modified" },
    { name: "scripts/pptx-fixtures/judge-proof.json", status: "modified" },
    { name: "packages/pptx/src/slide-route.ts", status: "modified" },
  ]),
  [deck, "scripts/pptx-fixtures/text.pptx", "scripts/pptx-fixtures/clean.pptx"],
)
same("a swapped deck needs the owner", texts({ changedFixtures: [deck] }), [
  `${deck} is a deck the PowerPoint check already judges.`,
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
const rootConfig = { files: [], references: [{ path: "./packages/document" }] }
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
    { name: "packages/document/tsconfig.json", status: "modified" },
    { name: "packages/catalog/deep/tsconfig.json", status: "added" },
    { name: "apps/web/tsconfig.json", status: "added" },
  ].map((file) => newPackageFile(file, "tsconfig.json")),
  [true, false, false, false],
)

const review = (user, state, commit) => ({ user, state, commit })
same("no review", approvedCommit("owner", []), undefined)
same("the owner's approval names its commit", approvedCommit("owner", [review("owner", "APPROVED", "abc")]), "abc")
same("someone else's approval does not count", approvedCommit("owner", [review("agent", "APPROVED", "abc")]), undefined)
same(
  "a later request for changes voids it",
  approvedCommit("owner", [review("owner", "APPROVED", "abc"), review("owner", "CHANGES_REQUESTED", "abc")]),
  undefined,
)
same("a dismissed approval does not count", approvedCommit("owner", [review("owner", "DISMISSED", "abc")]), undefined)
same(
  "a later comment keeps it",
  approvedCommit("owner", [review("owner", "APPROVED", "abc"), review("owner", "COMMENTED", "def")]),
  "abc",
)

const blocksOf = (change) =>
  ownerReasons({ baseMetrics: metrics, headMetrics: metrics, changedFiles: [], changedScripts: [], ...change }).map(
    (reason) => reason.blocks,
  )
same("a raised limit blocks", blocksOf(withMetric("ci-duration", { limit: 60 })), [true])
same("a dropped deck count blocks", blocksOf(withMetric(decks, { now: 1, goal: 20 })), [true])
same("a moved goal blocks", blocksOf(withMetric("known-failures", { now: 2, goal: 5 })), [true])
same("a recorded fault is listed and does not block", blocksOf(withMetric("known-failures", { now: 3, goal: 0 })), [
  false,
])
same("a changed check file is listed and does not block", blocksOf({ changedFiles: ["scripts/check.mjs"] }), [false])
same("changed scripts are listed and do not block", blocksOf({ changedScripts: ["package.json"] }), [false])
same("a changed case blocks", blocksOf({ changedCases: ["text-page"] }), [true])
same("a swapped deck blocks", blocksOf({ changedFixtures: [deck] }), [true])
same("a lost kind blocks", blocksOf({ changedKinds: ["duplicate shape id"] }), [true])

const listedOnly = verdict({
  owner: "owner",
  reasons: [{ about: "file AGENTS.md", text: "AGENTS.md decides what ci checks.", blocks: false }],
  headPrints: {},
})
same("a pull that only touches the checks passes and is listed", [listedOnly.pass, listedOnly.listed], [true, true])
same("its line says it does not block", listedOnly.lines, [
  "Listed for owner, does not block: AGENTS.md decides what ci checks.",
])

const reasons = [
  {
    about: "file scripts/pptx-fixtures/a.pptx",
    text: "a.pptx is a deck the PowerPoint check already judges.",
    blocks: true,
  },
  { about: "metric ci-duration", text: "The limit of ci-duration went from 40 to 60.", blocks: true },
]
const prints = { "file scripts/pptx-fixtures/a.pptx": "blob1", "metric ci-duration": '{"limit":60}' }
const untouched = verdict({ owner: "owner", reasons: [], headPrints: {} })
same("nothing to accept passes and is not listed", [untouched.pass, untouched.listed], [true, false])
const waiting = verdict({ owner: "owner", reasons, headPrints: prints })
same("an unapproved pull waits", waiting.pass, false)
if (!waiting.lines.includes("Undo what lowers the bar. Only an approval from owner lets it through as it is.")) {
  throw new Error(waiting.lines.join("\n"))
}
const forks = { "file scripts/pptx-fixtures/a.pptx": "base1", "metric ci-duration": '{"limit":40}' }
const settled = {
  owner: "owner",
  reasons,
  headPrints: prints,
  approvedPrints: prints,
  forkPrints: forks,
  approvedForkPrints: forks,
}
same("an approval of this content passes", verdict(settled).pass, true)
const amended = verdict({ ...settled, headPrints: { ...prints, "file scripts/pptx-fixtures/a.pptx": "blob2" } })
same("content changed after the approval waits again", amended.pass, false)
if (!amended.lines.includes("Changed since owner approved: file scripts/pptx-fixtures/a.pptx.")) {
  throw new Error(amended.lines.join("\n"))
}
same(
  "a metric that got worse again after the approval waits again",
  verdict({ ...settled, headPrints: { ...prints, "metric ci-duration": '{"limit":99}' } }).pass,
  false,
)
const reverted = verdict({ ...settled, forkPrints: { ...forks, "metric ci-duration": '{"limit":30}' } })
same("an approval does not cover what main changed since", reverted.pass, false)
if (!reverted.lines.includes("Changed on main since owner approved: metric ci-duration.")) {
  throw new Error(reverted.lines.join("\n"))
}

same(
  "a removed test file is named, and so is one renamed into a file that is not a test",
  removedTestFiles([
    { name: "packages/pptx/src/slide-route.test.ts", status: "removed" },
    { name: "tests/browser/every-screen.spec.ts", status: "removed" },
    { name: "packages/pptx/src/notes.ts", before: "packages/pptx/src/shape-id.test.ts", status: "renamed" },
    { name: "packages/pptx/src/shape.test.ts", before: "packages/pptx/src/shape-id.test.ts", status: "renamed" },
    { name: "packages/pptx/src/new.test.ts", status: "added" },
    { name: "packages/pptx/src/old.test.ts", status: "modified" },
    { name: "packages/pptx/src/slide-route.ts", status: "removed" },
  ]),
  ["packages/pptx/src/slide-route.test.ts", "tests/browser/every-screen.spec.ts", "packages/pptx/src/shape-id.test.ts"],
)
const removedTest = ownerReasons({
  baseMetrics: metrics,
  headMetrics: metrics,
  changedFiles: [],
  changedScripts: [],
  removedTests: ["packages/pptx/src/slide-route.test.ts"],
})
same("a removed test file lowers the bar", removedTest, [
  {
    about: "file packages/pptx/src/slide-route.test.ts",
    text: "The test file packages/pptx/src/slide-route.test.ts was removed.",
    blocks: true,
  },
])

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
  withRoutes({ now: 6, goal: 3 }, { now: 6, goal: 0 }),
  [],
)
same(
  "for a count that should fall, a goal further up is a lower bar",
  withRoutes({ now: 6, goal: 3 }, { now: 6, goal: 5 }),
  [`The goal of ${routes} went from 3 to 5.`],
)
same(
  "a goal that moves when the count already met it needs the owner",
  withRoutes({ now: 4, goal: 4 }, { now: 4, goal: 9 }),
  [`The goal of ${routes} went from 4 to 9.`],
)

const renamed = {
  "known-failures": { now: 17, goal: 0 },
  "test-count": { floor: 199 },
  "corpus-size": { now: 2, goal: 20 },
  "fault-detection": { now: 9, goal: 10 },
  "export-coverage": { now: 17, goal: 50 },
  "export-verified": { now: 18, goal: 50 },
  "ci-duration": { limit: 40 },
  "pptx-check-duration": { limit: 90 },
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
  "a floor lowered across the rename is still caught",
  ownerReasons({
    baseMetrics: atMergeBase,
    headMetrics: { ...atHead, "test-count": { floor: 198 } },
    changedFiles: [],
    changedScripts: [],
  }).map((reason) => reason.text),
  ["The floor of test-count went from 199 to 198."],
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
same("the owner is read from an https remote", ownerOf("https://github.com/Rickvu309/AirDesign.git"), "Rickvu309")
same("the owner is read from an ssh remote", ownerOf("git@github.com:Rickvu309/AirDesign.git"), "Rickvu309")
same("no remote names the repo owner", ownerOf(undefined), "the repo owner")
same(
  "the reasons read through any reader",
  readReasons({
    json: (sha, file) => (file === "metrics.json" ? { "ci-duration": { limit: sha === "fork" ? 40 : 45 } } : undefined),
    fork: "fork",
    head: "head",
    listed: [{ name: "metrics.json", status: "modified" }],
  }).map((reason) => reason.text),
  ["The limit of ci-duration went from 40 to 45."],
)

const localRepo = fs.mkdtempSync(path.join(os.tmpdir(), "airdesign-ratchet-local-"))
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
localFile("metrics.json", JSON.stringify({ "ci-duration": { limit: 40 }, "corpus-size": { now: 2, goal: 20 } }))
localFile("scripts/pptx-fixtures/cases.json", JSON.stringify([{ name: "nasa-1d-cnn" }, { name: "doe-heat-pumps" }]))
localFile("packages/pptx/src/route.test.ts", "case\n")
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
localFile("metrics.json", JSON.stringify({ "ci-duration": { limit: 50 }, "corpus-size": { now: 1, goal: 20 } }))
localFile("scripts/pptx-fixtures/cases.json", JSON.stringify([{ name: "nasa-1d-cnn" }]))
fs.rmSync(path.join(localRepo, "packages/pptx/src/route.test.ts"))
localFile("scripts/new-check.mjs", "check\n")
const localVerdict = verdict(readLocal(localRepo))
same("a lowered bar in the working tree fails locally", localVerdict.pass, false)
same("the local verdict says what ci says", localVerdict.lines, [
  "Lowers the bar: The limit of ci-duration went from 40 to 50.",
  "Lowers the bar: corpus-size went from 2 to 1, away from its goal of 20.",
  "Lowers the bar: The test file packages/pptx/src/route.test.ts was removed.",
  "Lowers the bar: The PowerPoint case doe-heat-pumps was changed or removed.",
  "Listed for Rickvu309, does not block: scripts/new-check.mjs decides what ci checks.",
  "Undo what lowers the bar. Only an approval from Rickvu309 lets it through as it is.",
])
const localStep = () => {
  try {
    return {
      status: 0,
      output: execFileSync(process.execPath, ["scripts/ratchet.mjs", "local", localRepo], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    }
  } catch (error) {
    return { status: error.status, output: `${error.stdout}${error.stderr}` }
  }
}
same("locally a lowered bar prints what ci says, warns and passes", localStep(), {
  status: 0,
  output: [...localVerdict.lines, localWarning("ratchet", "Rickvu309"), ""].join("\n"),
})
same(
  "the local warning names the check on GitHub and the owner",
  localWarning("ratchet", "Rickvu309"),
  "Warning: the ratchet check on GitHub blocks this unless Rickvu309 approves it. This step passes, and GitHub judges.",
)
same("reading the working tree leaves the index alone", localGit(["diff", "--cached", "--name-only"]), "")
same("the working tree is read with what is not staged", workingTree(localRepo) === localGit(["write-tree"]), false)

console.log("ratchet tests passed")
