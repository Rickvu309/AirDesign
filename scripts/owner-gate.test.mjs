import {
  approvedCommit,
  contents,
  guarded,
  lostCases,
  newPackageFile,
  onlyAddsReferences,
  ownerReasons,
  packageFile,
  replacedFixtures,
  sameButReferences,
  verdict,
} from "./owner-gate.mjs"

const sticks = {
  "known faults": { now: 2, goal: 0 },
  "real decks in the PowerPoint check": { now: 2, goal: 20 },
  "check seconds": { limit: 40 },
}
const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const texts = (change) =>
  ownerReasons({ baseSticks: sticks, headSticks: sticks, changedFiles: [], changedScripts: [], ...change }).map(
    (reason) => reason.text,
  )
const withStick = (name, value) => ({ headSticks: { ...sticks, [name]: value } })
const decks = "real decks in the PowerPoint check"

same("product code alone needs nobody", texts({ changedFiles: ["packages/pptx/src/slide-route.ts"] }), [])
same("a fixed fault needs nobody", texts(withStick("known faults", { now: 1, goal: 0 })), [])
same("a deck added needs nobody", texts(withStick(decks, { now: 3, goal: 20 })), [])
same("a tighter limit needs nobody", texts(withStick("check seconds", { limit: 30 })), [])
same("a new stick needs nobody", texts(withStick("new one", { now: 9, goal: 0 })), [])
same("a new fault needs the owner", texts(withStick("known faults", { now: 3, goal: 0 })), [
  "known faults went from 2 to 3, away from its goal of 0.",
])
same("a deck dropped needs the owner", texts(withStick(decks, { now: 1, goal: 20 })), [
  `${decks} went from 2 to 1, away from its goal of 20.`,
])
same("a count that jumps past its goal needs the owner", texts(withStick(decks, { now: 38, goal: 20 })), [
  `${decks} went from 2 to 38, away from its goal of 20.`,
])
same("a looser limit needs the owner", texts(withStick("check seconds", { limit: 60 })), [
  "The limit of check seconds went from 40 to 60.",
])
same("a moved goal needs the owner", texts(withStick("known faults", { now: 2, goal: 5 })), [
  "The goal of known faults went from 0 to 5.",
])
same("a limit turned into a count needs the owner", texts(withStick("check seconds", { now: 1, goal: 0 })), [
  "The stick check seconds stopped being a limit.",
])
same("a removed stick needs the owner", texts({ headSticks: { "known faults": sticks["known faults"] } }).length, 2)
for (const loose of [
  { limit: "9" },
  { limit: null },
  { limit: [39] },
  { now: null, goal: 0 },
  { now: "0", goal: 0 },
  7,
  null,
]) {
  same(`a stick shaped ${JSON.stringify(loose)} needs the owner`, texts(withStick("known faults", loose)), [
    "The stick known faults must be only a limit, or only now and goal, as numbers.",
  ])
}
same("a malformed new stick needs the owner", texts(withStick("new one", { now: [] })).length, 1)

for (const file of [
  ".github/workflows/gate.yml",
  "tooling/oxlint-plugin-airdesign/rules/no-raw.js",
  "AGENTS.md",
  "scripts/sticks.mjs",
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
  if (!guarded(file)) throw new Error(`${file} decides the gate and is not guarded`)
}
for (const file of [
  "apps/web/src/App.tsx",
  "packages/pptx/src/slide-route.ts",
  "scripts/pptx-fixtures/cases.json",
  "sticks.json",
]) {
  if (guarded(file)) throw new Error(`${file} is product or data and is guarded`)
}
same(
  "package files are found",
  ["package.json", "packages/pptx/package.json", "apps/web/src/package.json.ts"].map(packageFile),
  [true, true, false],
)
same("changed scripts need the owner", texts({ changedScripts: ["package.json"] }), [
  "The scripts in package.json changed, and they are what the gate runs.",
])

same("a count given a limit as well needs the owner", texts(withStick("known faults", { now: 2, goal: 0, limit: 5 })), [
  "The stick known faults must be only a limit, or only now and goal, as numbers.",
])
same("a count turned into a limit needs the owner", texts(withStick("known faults", { limit: 5 })), [
  "The stick known faults stopped being a count with a goal.",
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

const deck = "scripts/pptx-fixtures/nasa-1d-cnn.pptx"
same(
  "a deck already judged that is swapped, removed or moved is named, and a new one is not",
  replacedFixtures([
    { name: deck, status: "modified" },
    { name: "scripts/pptx-fixtures/text.pptx", status: "removed" },
    { name: "apps/web/moved.pptx", before: "scripts/pptx-fixtures/clean.pptx", status: "renamed" },
    { name: "scripts/pptx-fixtures/new-deck.pptx", status: "added" },
    { name: "scripts/pptx-fixtures/cases.json", status: "modified" },
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
  ownerReasons({ baseSticks: sticks, headSticks: sticks, changedFiles: [], changedScripts: [], ...change }).map(
    (reason) => reason.blocks,
  )
same("a raised limit blocks", blocksOf(withStick("check seconds", { limit: 60 })), [true])
same("a dropped deck count blocks", blocksOf(withStick(decks, { now: 1, goal: 20 })), [true])
same("a moved goal blocks", blocksOf(withStick("known faults", { now: 2, goal: 5 })), [true])
same("a recorded fault is listed and does not block", blocksOf(withStick("known faults", { now: 3, goal: 0 })), [false])
same("a changed check file is listed and does not block", blocksOf({ changedFiles: ["scripts/check.mjs"] }), [false])
same("changed scripts are listed and do not block", blocksOf({ changedScripts: ["package.json"] }), [false])
same("a changed case blocks", blocksOf({ changedCases: ["text-page"] }), [true])
same("a swapped deck blocks", blocksOf({ changedFixtures: [deck] }), [true])

const listedOnly = verdict({
  owner: "owner",
  reasons: [{ about: "file AGENTS.md", text: "AGENTS.md decides what the gate checks.", blocks: false }],
  headPrints: {},
})
same("a pull that only touches the checks passes and is listed", [listedOnly.pass, listedOnly.listed], [true, true])
same("its line says it does not block", listedOnly.lines, [
  "Listed for owner, does not block: AGENTS.md decides what the gate checks.",
])

const reasons = [
  {
    about: "file scripts/pptx-fixtures/a.pptx",
    text: "a.pptx is a deck the PowerPoint check already judges.",
    blocks: true,
  },
  { about: "stick check seconds", text: "The limit of check seconds went from 40 to 60.", blocks: true },
]
const prints = { "file scripts/pptx-fixtures/a.pptx": "blob1", "stick check seconds": '{"limit":60}' }
const untouched = verdict({ owner: "owner", reasons: [], headPrints: {} })
same("nothing to accept passes and is not listed", [untouched.pass, untouched.listed], [true, false])
const waiting = verdict({ owner: "owner", reasons, headPrints: prints })
same("an unapproved pull waits", waiting.pass, false)
if (!waiting.lines.includes("Undo what lowers the bar. Only an approval from owner lets it through as it is.")) {
  throw new Error(waiting.lines.join("\n"))
}
const forks = { "file scripts/pptx-fixtures/a.pptx": "base1", "stick check seconds": '{"limit":40}' }
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
  "a stick that got worse again after the approval waits again",
  verdict({ ...settled, headPrints: { ...prints, "stick check seconds": '{"limit":99}' } }).pass,
  false,
)
const reverted = verdict({ ...settled, forkPrints: { ...forks, "stick check seconds": '{"limit":30}' } })
same("an approval does not cover what main changed since", reverted.pass, false)
if (!reverted.lines.includes("Changed on main since owner approved: stick check seconds.")) {
  throw new Error(reverted.lines.join("\n"))
}

console.log("owner-gate tests passed")
