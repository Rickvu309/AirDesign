import fs from "node:fs"
import { judge } from "./judge.mjs"
import {
  changedSinceArgs,
  changesJudge,
  benignKinds,
  changesJudgeSource,
  breakKinds,
  caughtCount,
  freshMissFails,
  kindVerdicts,
  proofFailures,
  proofTable,
  readSeedList,
  replay,
  sampleSeed,
  seedFrom,
  seededRandom,
  seedsFor,
  settleRun,
} from "./judge-proof.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}
const drawn = (seed) => {
  const random = seededRandom(seed)
  return [
    random.between(256, 2147483647),
    random.word(),
    random.pick(["a", "b", "c"]),
    random.shuffled([1, 2, 3, 4, 5]),
  ]
}
same("one seed draws the same values every time", drawn(7), drawn(7))
same("one seed draws known values", drawn(7), [25136018, "zsnkm", "a", [2, 4, 1, 5, 3]])
if (JSON.stringify(drawn(7)) === JSON.stringify(drawn(8))) throw new Error("two seeds drew the same values")
const order = seededRandom(3).shuffled([1, 2, 3, 4, 5, 6])
same("a shuffle keeps every item", order.toSorted(), [1, 2, 3, 4, 5, 6])
for (let draw = 0, random = seededRandom(11); draw < 1000; draw += 1) {
  const value = random.between(5, 8)
  if (value < 5 || value > 7) throw new Error(`between drew ${value}`)
}

same("a chosen seed wins over the commit", seedFrom({ chosen: "42", commit: "786ff3b1aa\n" }), 42)
same(
  "the commit gives the seed when none is chosen",
  seedFrom({ chosen: undefined, commit: "786ff3b1aa\n" }),
  2020602801,
)
same("an empty choice falls back to the commit", seedFrom({ chosen: "", commit: "0000000f" }), 15)
let refused = ""
try {
  seedFrom({ chosen: "soon", commit: "0000000f" })
} catch (error) {
  refused = error.message
}
same(
  "a seed that is not a number is refused",
  refused,
  "JUDGE_SEED must be a whole number from 0 to 4294967295, and it is soon.",
)
let hashRefused = ""
try {
  seedFrom({ chosen: "786ff3b1", commit: "0000000f" })
} catch (error) {
  hashRefused = error.message
}
same(
  "a commit hash is not a seed",
  hashRefused,
  "JUDGE_SEED must be a whole number from 0 to 4294967295, and it is 786ff3b1.",
)
const list = readSeedList(fs.readFileSync(new URL("./pptx-fixtures/judge-seeds.json", import.meta.url), "utf8"))
same("the seed list is read and holds both seeds", list.seeds, [424603714, 2835851095])
same("the seed list now names no known miss", list.known, [])
const listed = {
  seeds: list.seeds,
  known: [
    { seed: 424603714, kind: "wrong child order", deck: "doe-heat-pumps.pptx", what: "a" },
    { seed: 2835851095, kind: "wrong child order", deck: "census-updating-spm.pptx", what: "b" },
  ],
}
const commit = "786ff3b1aa\n"
const plan = (chosen, draw = () => 1) => seedsFor({ chosen, list: listed, draw, commit })
same(
  "an unset JUDGE_SEED runs every listed seed and then one fresh seed",
  plan(undefined).map((run) => [run.seed, run.fresh]),
  [
    [424603714, false],
    [2835851095, false],
    [seedFrom({ chosen: undefined, commit }), true],
  ],
)
same(
  "an empty JUDGE_SEED runs the fresh seed from seedFrom on the commit",
  plan("").at(-1).seed,
  seedFrom({ chosen: "", commit }),
)
same("the fresh seed is announced with its replay line", plan(undefined).at(-1).announce, `fresh ${replay(2020602801)}`)
same("the fresh seed excuses no known miss", plan(undefined).at(-1).known, [])
same("the fresh seed says to fix the cause and add the seed", plan(undefined).at(-1).chosen, true)
same("every listed seed keeps the list's known misses", plan(undefined)[0].known, listed.known)
same("JUDGE_SEED runs one seed and only its own known misses", plan("424603714"), [
  { seed: 424603714, known: [listed.known[0]], chosen: true, fresh: false, announce: replay(424603714) },
])
same(
  "JUDGE_SEED ignores known misses of other seeds",
  plan("3").map((run) => run.known),
  [[]],
)
const randomRun = plan("random", () => 99)
same(
  "JUDGE_SEED=random draws one seed and uses no known misses",
  randomRun.map((run) => [run.seed, run.known, run.fresh]),
  [[99, [], false]],
)
same("JUDGE_SEED=random prints the seed and the replay line", randomRun[0].announce, `random ${replay(99)}`)

const headSha = "a".repeat(40)
const baseSha = "b".repeat(40)
const judgeChange = ["scripts/judge.mjs"]
const otherChange = ["apps/web/src/a.ts"]
const decide = (extra) =>
  freshMissFails({
    eventText: undefined,
    mergeBase: () => {
      throw new Error("unused")
    },
    changedSince: () => {
      throw new Error("unused")
    },
    ...extra,
  })
const seenBases = []
const changedFor = (files) => (base) => {
  seenBases.push(base)
  return files
}
const pullRequest = JSON.stringify({ pull_request: { base: { sha: baseSha } }, before: headSha })
const mergeGroup = JSON.stringify({ merge_group: { base_sha: baseSha } })
const push = JSON.stringify({ before: baseSha })
for (const [name, eventText] of [
  ["pull_request", pullRequest],
  ["merge_group", mergeGroup],
  ["push", push],
]) {
  same(
    `${name}: a judge file change fails a fresh miss`,
    decide({ eventText, changedSince: changedFor(judgeChange) }),
    true,
  )
  same(
    `${name}: another change does not fail a fresh miss`,
    decide({ eventText, changedSince: changedFor(otherChange) }),
    false,
  )
  same(`${name}: the event base is the one compared`, seenBases.splice(0), [baseSha, baseSha])
}
same(
  "outside CI the merge base is compared and a judge change fails",
  decide({ mergeBase: () => baseSha, changedSince: changedFor(judgeChange) }),
  true,
)
same(
  "outside CI another change passes",
  decide({ mergeBase: () => baseSha, changedSince: changedFor(otherChange) }),
  false,
)
same("outside CI the merge base went to the comparison", seenBases.splice(0), [baseSha, baseSha])
for (const [name, eventText] of [
  ["an event with no base", JSON.stringify({ action: "dispatched" })],
  ["a push from a new branch", JSON.stringify({ before: "0".repeat(40) })],
  ["a short commit id", JSON.stringify({ pull_request: { base: { sha: "abc" } } })],
  ["an empty event file", ""],
  ["a broken event file", "{"],
]) {
  same(`${name} fails a fresh miss`, decide({ eventText }), true)
}
same("an unknown merge base fails a fresh miss", decide({ mergeBase: () => undefined }), true)
same("a failed comparison fails a fresh miss", decide({ eventText: push, changedSince: () => undefined }), true)
for (const file of [
  "scripts/judge.mjs",
  "scripts/judge-proof.mjs",
  "scripts/pptx-check.mjs",
  "scripts/pptx-fixtures/judge-proof.json",
  "scripts/pptx-fixtures/judge-seeds.json",
]) {
  same(`${file} is a judge file`, changesJudge([file]), true)
}
for (const file of [
  "scripts/judge.mjs.bak",
  "scripts/pptx-fixtures/cases.json",
  "scripts/pptx-fixtures/deep/judge-proof.json",
  "scripts/pptx-fixtures/judge-proof.txt",
  "packages/pptx/src/child-order.ts",
]) {
  same(`${file} is not a judge file`, changesJudge([file]), false)
}
same("no changed file is not a judge change", changesJudge([]), false)
for (const file of [
  "packages/pptx/src/child-order.ts",
  "packages/pptx/src/shape-id.ts",
  "packages/pptx/src/validator-error.ts",
  "scripts/pptx-judge/Program.cs",
  "scripts/pptx-judge/PptxJudge.csproj",
]) {
  same(`${file} is code the judge runs`, changesJudgeSource([file]), true)
  same(`${file} fails a fresh miss`, decide({ eventText: push, changedSince: () => [file] }), true)
}
for (const file of [
  "packages/pptx/src/index.ts",
  "packages/pptx/src/child-order.test.ts",
  "packages/pptx/src/read-shapes.ts",
  "scripts/pptx-judge/obj/project.assets.json",
]) {
  same(`${file} is not code the judge runs`, changesJudgeSource([file]), false)
  same(`${file} leaves a fresh miss printed only`, decide({ eventText: push, changedSince: () => [file] }), false)
}
same("a rename lists both paths", changedSinceArgs("base"), ["diff", "--no-renames", "--name-only", "base", "HEAD"])

const freshRun = { seed: 5, fresh: true }
const fixedRun = { seed: 5, fresh: false }
const missLine =
  "The judge missed second, recorded caught: a.pptx, slide 2. seed 5, replay with JUDGE_SEED=5 pnpm check:pptx"
same("a fresh miss on a judge change fails", settleRun({ run: freshRun, lines: [missLine], freshFails: true }), {
  failed: 1,
  lines: [missLine],
})
const printed = settleRun({ run: freshRun, lines: [missLine], freshFails: false })
same("a fresh miss on another pull request does not fail", printed.failed, 0)
same(
  "a fresh miss on another pull request prints its replay line",
  printed.lines.length === 1 && printed.lines[0].includes("replay with JUDGE_SEED=5 pnpm check:pptx"),
  true,
)
same("a fixed seed miss always fails", settleRun({ run: fixedRun, lines: [missLine], freshFails: false }), {
  failed: 1,
  lines: [missLine],
})
same(
  "a fresh run with no miss has nothing to fail",
  settleRun({ run: freshRun, lines: [], freshFails: true }).failed,
  0,
)

const countingPptx = {
  newValidatorErrors: (before, after) => after.filter((line) => !before.includes(line)),
  newDuplicateShapeIds: () => [],
}
const orderFault = "Order: p:spPr after p:txBody in p:sp of a markup branch /ppt/slides/slide1.xml"
same(
  "the judge rejects a new order error",
  judge(countingPptx, { list: [], ids: [], orders: [] }, { list: [], ids: [], orders: [orderFault] }).accepted,
  false,
)
same(
  "the judge does not blame an order error the deck already had",
  judge(countingPptx, { list: [], ids: [], orders: [orderFault] }, { list: [], ids: [], orders: [orderFault] })
    .accepted,
  true,
)

same("a sample seed is the same for the same sample", sampleSeed(1, "kind", 0), sampleSeed(1, "kind", 0))
const sampleSeeds = [
  sampleSeed(1, "kind", 0),
  sampleSeed(1, "kind", 1),
  sampleSeed(1, "other", 0),
  sampleSeed(2, "kind", 0),
]
same("each seed, kind and sample draws on its own", new Set(sampleSeeds).size, 4)

const sample = (kind, accepted, extra = {}) => ({
  kind,
  benign: false,
  deck: "a.pptx",
  what: `slide ${accepted ? 2 : 1}`,
  accepted,
  ...extra,
})
const judged = [
  sample("first", false),
  sample("first", false),
  sample("second", false),
  sample("second", true),
  sample("second", false),
  sample("third", true),
  sample("valid edit", true, { benign: true }),
]
same("a kind is caught only when every sample is caught", kindVerdicts(judged), {
  first: "caught",
  second: "missed",
  third: "missed",
})
same("caught kinds are counted against all kinds", caughtCount(kindVerdicts(judged)), { now: 1, goal: 3 })

const again = "seed 5, replay with JUDGE_SEED=5 pnpm check:pptx"
const recorded = { first: "caught", second: "missed", third: "missed" }
same("a matching record has no failure", proofFailures({ recorded, judged, seed: 5 }), [])
same(
  "a caught kind that is now missed is named with its sample and seed",
  proofFailures({ recorded: { ...recorded, second: "caught" }, judged, seed: 5 }),
  [`The judge missed second, recorded caught: a.pptx, slide 2. ${again}`],
)
const traded = [sample("first", true), sample("second", false), sample("third", true)]
same("a kind gained does not hide a kind lost", proofFailures({ recorded, judged: traded, seed: 5 }), [
  `The judge missed first, recorded caught: a.pptx, slide 2. ${again}`,
  `The judge now catches second and judge-proof.json says missed. Record caught there and in metrics.json. ${again}`,
])
same(
  "a kind without a record is named",
  proofFailures({ recorded: { first: "caught", second: "missed" }, judged, seed: 5 }),
  [`third is missed and judge-proof.json does not record it. Record missed there. ${again}`],
)
same(
  "a record without a kind is named",
  proofFailures({ recorded: { ...recorded, gone: "caught" }, judged, seed: 5 }),
  ["gone is in judge-proof.json and no mutator plants it."],
)
same(
  "a rejected valid edit is named and has no record to hide in",
  proofFailures({
    recorded: { ...recorded, "valid edit": "missed" },
    judged: [...judged.slice(0, 6), sample("valid edit", false, { benign: true, reason: "Schema: bad" })],
    seed: 5,
  }),
  [
    "valid edit is in judge-proof.json and no mutator plants it.",
    `The judge rejected valid edit, an edit that leaves the file valid: a.pptx, slide 1: Schema: bad. ${again}`,
  ],
)
same("the table gives each kind its own verdict", proofTable(judged), [
  "judge break  first       caught    2 of 2 samples caught",
  "judge break  second      missed    2 of 3 samples caught",
  "judge break  third       missed    0 of 1 samples caught",
  "judge valid  valid edit  accepted  1 of 1 samples accepted",
])
same("ten break kinds are planted", Object.keys(breakKinds).length, 10)

const knownMiss = [{ seed: 5, kind: "second", deck: "a.pptx", what: "slide 2" }]
const recordedCaught = { first: "caught", second: "caught" }
const listedJudged = [sample("first", false), sample("second", true)]
same(
  "a listed miss passes",
  proofFailures({ recorded: recordedCaught, judged: listedJudged, seed: 5, known: knownMiss }),
  [],
)
same(
  "a listed miss that is caught fails with the delete line",
  proofFailures({
    recorded: recordedCaught,
    judged: [sample("first", false), sample("second", false, { what: "slide 2" })],
    seed: 5,
    known: knownMiss,
  }),
  [`The judge caught second, and the seed list still names this miss: a.pptx, slide 2. Delete that entry. ${again}`],
)
same(
  "an unlisted miss fails",
  proofFailures({
    recorded: recordedCaught,
    judged: [sample("first", false), sample("second", true)],
    seed: 5,
    known: [{ seed: 9, kind: "second", deck: "a.pptx", what: "slide 2" }],
  }),
  [`The judge missed second, recorded caught: a.pptx, slide 2. ${again}`],
)
same(
  "a listed miss does not excuse the same kind on another deck",
  proofFailures({
    recorded: recordedCaught,
    judged: [sample("first", false), sample("second", true), sample("second", true, { deck: "b.pptx" })],
    seed: 5,
    known: knownMiss,
  }),
  [`The judge missed second, recorded caught: b.pptx, slide 2. ${again}`],
)
same(
  "a listed miss does not excuse the same kind at another place in the deck",
  proofFailures({
    recorded: recordedCaught,
    judged: [sample("first", false), sample("second", true), sample("second", true, { what: "slide 3" })],
    seed: 5,
    known: knownMiss,
  }),
  [`The judge missed second, recorded caught: a.pptx, slide 3. ${again}`],
)
same(
  "a listed miss does not excuse another kind at the same place",
  proofFailures({
    recorded: recordedCaught,
    judged: [sample("first", true), sample("second", false)],
    seed: 5,
    known: knownMiss,
  }),
  [
    `The judge missed first, recorded caught: a.pptx, slide 2. ${again}`,
    `The judge caught second, and the seed list still names this miss: a.pptx, slide 2. Delete that entry. ${again}`,
  ],
)
same(
  "a chosen or random seed says to fix the cause and add the seed",
  proofFailures({
    recorded: { ...recordedCaught, third: "caught" },
    judged: [sample("first", false), sample("second", true), sample("third", true, { what: "other" })],
    seed: 5,
    known: [...knownMiss, { seed: 9, kind: "third", deck: "a.pptx", what: "other" }],
    chosen: true,
  }),
  [`The judge missed third, recorded caught: a.pptx, other. Fix the cause, then add the seed to the list. ${again}`],
)

const plantPart = "ppt/slides/slide1.xml"
const plantParts = new Map([[plantPart, new Uint8Array(1)]])
const severalParagraphs = [
  { from: 0, runs: [{ from: 0, text: "One" }] },
  { from: 1, runs: [{ from: 0, text: "Two" }] },
]
const plantPptx = (rows, asked) => ({
  shapeIdCounts: () => rows.map((row) => ({ part: plantPart, id: row.shape, count: 1 })),
  readShapes: () => rows.map((row) => ({ part: plantPart, shape: row.shape, text: row.text })),
  oneRunValue: (value, text) => {
    if (value.length !== 1) throw new Error("text-shape")
    return [{ from: value[0].from, runs: [{ from: 0, text }] }]
  },
  applyRoute: (parts, route) => {
    asked.push(route.shape)
    return new Map([[plantPart, new Uint8Array(2)]])
  },
})
const plantAsked = []
const planted = benignKinds["text replaced"](
  plantPptx(
    [
      { shape: "2", text: severalParagraphs },
      { shape: "3", text: [{ from: 0, runs: [{ from: 0, text: "One" }] }] },
    ],
    plantAsked,
  ),
  new Map(plantParts),
  seededRandom(5),
)
same("the text plant writes only a shape with one run", plantAsked, ["3"])
same("the text plant names the shape it wrote", planted.what.includes("shape 3,"), true)
let noPlace = ""
try {
  benignKinds["text replaced"](
    plantPptx([{ shape: "2", text: severalParagraphs }], plantAsked),
    new Map(plantParts),
    seededRandom(5),
  )
} catch (error) {
  noPlace = error.constructor.name
}
same("the text plant reports no place when no shape has one run", noPlace, "NoPlace")
same("the text plant never routes a box with several paragraphs", plantAsked, ["3"])

console.log("judge-proof tests passed")
