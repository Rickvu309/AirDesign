import {
  breakKinds,
  caughtCount,
  kindVerdicts,
  proofFailures,
  proofTable,
  sampleSeed,
  seedFrom,
  seededRandom,
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
  `The judge now catches second and judge-proof.json says missed. Record caught there and in sticks.json. ${again}`,
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

console.log("judge-proof tests passed")
