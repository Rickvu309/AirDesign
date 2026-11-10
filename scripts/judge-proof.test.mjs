import fs from "node:fs"
import {
  breakKinds,
  caughtCount,
  kindVerdicts,
  proofFailures,
  proofTable,
  readSeedList,
  replay,
  sampleSeed,
  seedFrom,
  seededRandom,
  seedsFor,
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

same("no seed is taken from the commit", seedFrom(undefined), { mode: "list" })
same("an empty choice is the seed list", seedFrom(""), { mode: "list" })
same("JUDGE_SEED chooses that seed", seedFrom("42"), { mode: "one", seed: 42 })
same("JUDGE_SEED=random asks for a random seed", seedFrom("random"), { mode: "random" })
let refused = ""
try {
  seedFrom("soon")
} catch (error) {
  refused = error.message
}
same(
  "a seed that is not a number is refused",
  refused,
  "JUDGE_SEED must be a whole number from 0 to 4294967295, or random, and it is soon.",
)
let hashRefused = ""
try {
  seedFrom("786ff3b1")
} catch (error) {
  hashRefused = error.message
}
same(
  "a commit hash is not a seed",
  hashRefused,
  "JUDGE_SEED must be a whole number from 0 to 4294967295, or random, and it is 786ff3b1.",
)
const list = readSeedList(fs.readFileSync(new URL("./pptx-fixtures/judge-seeds.json", import.meta.url), "utf8"))
same("the seed list is read and holds both seeds", list.seeds, [424603714, 2835851095])
same("the seed list carries both known misses", list.known, [
  {
    seed: 424603714,
    kind: "wrong child order",
    deck: "doe-heat-pumps.pptx",
    what: "ppt/slides/slide17.xml shape 2 of 3",
  },
  {
    seed: 2835851095,
    kind: "wrong child order",
    deck: "census-updating-spm.pptx",
    what: "ppt/slides/slide25.xml shape 2 of 4",
  },
])
same(
  "an unset JUDGE_SEED runs every listed seed",
  seedsFor({ chosen: undefined, list, draw: () => 1 }).seeds,
  list.seeds,
)
same("JUDGE_SEED runs one seed and only its own known misses", seedsFor({ chosen: "424603714", list, draw: () => 1 }), {
  seeds: [424603714],
  known: [list.known[0]],
  chosen: true,
  announce: [replay(424603714)],
})
same("JUDGE_SEED ignores known misses of other seeds", seedsFor({ chosen: "3", list, draw: () => 1 }).known, [])
const randomRun = seedsFor({ chosen: "random", list, draw: () => 99 })
same("JUDGE_SEED=random draws one seed and uses no known misses", [randomRun.seeds, randomRun.known], [[99], []])
same("JUDGE_SEED=random prints the seed and the replay line", randomRun.announce, [`random ${replay(99)}`])

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

console.log("judge-proof tests passed")
