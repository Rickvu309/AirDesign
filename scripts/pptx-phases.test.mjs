import assert from "node:assert/strict"
import { besideBrowser, phaseClock } from "./pptx-phases.mjs"

let tick = 0
const clock = phaseClock({ now: () => tick })
const spec = clock.begin("spec")
tick = 2000
await clock.time("render", async () => {
  tick = 5000
})
tick = 9000
spec()
await assert.rejects(
  clock.time("broken", async () => {
    tick = 10000
    throw new Error("broken")
  }),
  /broken/,
)
assert.deepEqual(clock.lines(), [
  "phase spec            0.0 to    9.0 seconds",
  "phase render          2.0 to    5.0 seconds",
  "phase broken          9.0 to   10.0 seconds",
])

const order = []
let finish
const browser = new Promise((resolve) => {
  finish = resolve
}).then(() => order.push("browser"))
const small = besideBrowser({ cores: 4, browser }).then(() => order.push("small"))
const roomy = besideBrowser({ cores: 5, browser }).then(() => order.push("roomy"))
await roomy
assert.deepEqual(order, ["roomy"])
finish()
await small
assert.deepEqual(order, ["roomy", "browser", "small"])
