import { labelChanges, longTitleLabel } from "./bar.mjs"

const same = (name, actual, expected) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${name}\n${JSON.stringify(actual)}\n${JSON.stringify(expected)}`)
  }
}

const quiet = { listed: false, lowers: false }
const hidden = { needed: false }

same("the label is long-title", longTitleLabel, "long-title")
same(
  "a pull request gets its areas and keeps no stale long-title or before-after label",
  labelChanges({
    result: quiet,
    shown: hidden,
    changedFiles: ["apps/web/src/aira/aira-panel.tsx"],
    title: "Keep a chat",
  }),
  { add: ["aira"], remove: ["needs-before-after", "long-title"] },
)
same(
  "a long title adds long-title",
  labelChanges({ result: quiet, shown: hidden, changedFiles: [], title: "A".repeat(73) }).add,
  ["long-title"],
)
same(
  "any break of the title rule adds long-title",
  labelChanges({ result: quiet, shown: hidden, changedFiles: [], title: "Add undo." }).add,
  ["long-title"],
)
same(
  "the bar labels, the areas, before-after and long-title add up, and nothing is removed",
  labelChanges({
    result: { listed: true, lowers: true },
    shown: { needed: true },
    changedFiles: ["scripts/land.mjs", "packages/pptx/src/write.ts"],
    title: `${"A".repeat(80)}`,
  }),
  { add: ["changes-ci", "lowers-the-bar", "pptx", "tooling", "needs-before-after", "long-title"], remove: [] },
)

console.log("bar label tests passed")
