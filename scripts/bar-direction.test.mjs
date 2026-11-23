import { ownerReasons } from "./bar.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const withMetricNamed = (name, base, head) =>
  ownerReasons({
    baseMetrics: { [name]: base },
    headMetrics: { [name]: head },
    changedFiles: [],
    changedScripts: [],
  }).map((reason) => reason.text)
same(
  "a raised goal met in the same change, from a count at its goal, needs nobody",
  withMetricNamed("eval-coverage", { now: 46, goal: 46, better: "higher" }, { now: 47, goal: 47, better: "higher" }),
  [],
)
same(
  "a lowered goal, from a count at its goal, needs the owner",
  withMetricNamed("eval-coverage", { now: 46, goal: 46, better: "higher" }, { now: 45, goal: 45, better: "higher" }),
  ["The goal of eval-coverage went from 46 to 45."],
)
same(
  "for a count that should fall, a goal and count moved down from the goal needs nobody",
  withMetricNamed("import-parse", { now: 100, goal: 100, better: "lower" }, { now: 90, goal: 90, better: "lower" }),
  [],
)
same(
  "for a count that should fall, a goal and count moved up from the goal needs the owner",
  withMetricNamed("import-parse", { now: 100, goal: 100, better: "lower" }, { now: 110, goal: 110, better: "lower" }),
  ["The goal of import-parse went from 100 to 110."],
)
same(
  "a flipped direction needs the owner",
  withMetricNamed("eval-coverage", { now: 46, goal: 46, better: "higher" }, { now: 46, goal: 46, better: "lower" }),
  ["The direction of eval-coverage went from higher to lower."],
)

console.log("bar direction tests passed")
