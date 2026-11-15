import { readFileSync } from "node:fs"
import { longestFirst } from "./longest-first.mjs"

const fail = (message) => {
  throw new Error(message)
}

const spec = (project, file, duration, groupOrder = 0) => ({
  project: { name: project, config: { sequence: { groupOrder } } },
  moduleId: file,
  duration,
})

const order = (specs) =>
  longestFirst(specs, (each) => each.duration)
    .map((each) => each.moduleId)
    .join(" ")

const named = [
  spec("api", "api-long", 14),
  spec("api", "api-short", 1),
  spec("render", "render-one", 0.5),
  spec("shared", "shared-long", 10),
  spec("shared", "shared-short", 0.1),
  spec("unit", "unit-long", 4),
  spec("unit", "unit-short", 0.2),
]

if (order(named) !== "api-long api-short shared-long shared-short unit-long unit-short render-one")
  fail(`projects do not start by their longest file: ${order(named)}`)

const unmeasured = [spec("render", "render-new", undefined), spec("unit", "unit-new", undefined)]
if (order(unmeasured) !== "render-new unit-new")
  fail(`projects with no recorded file do not keep name order: ${order(unmeasured)}`)

const grouped = [spec("api", "api-later", 14, 1), spec("unit", "unit-first", 1, 0)]
if (order(grouped) !== "unit-first api-later") fail(`a later group order runs first: ${order(grouped)}`)

const mixed = [spec("api", "api-1", 1), spec("unit", "unit-9", 9), spec("api", "api-2", 2), spec("unit", "unit-8", 8)]
if (order(mixed) !== "unit-9 unit-8 api-1 api-2")
  fail(`files leave their project's order or their project's block: ${order(mixed)}`)

const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8")
if (!/sequence: \{ sequencer: LongestFirst \}/.test(config))
  fail("vitest.config.mts no longer starts the longest projects first")
