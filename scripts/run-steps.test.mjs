import { runSteps } from "./run-steps.mjs"

const fail = (message) => {
  throw new Error(message)
}
const opened = () => {
  let open
  const gate = new Promise((resolve) => {
    open = resolve
  })
  return { gate, open }
}

const first = opened()
const second = opened()
const running = []
const together = runSteps({
  one: {
    run: async () => {
      running.push("one")
      await first.gate
      return 1
    },
  },
  two: {
    run: async () => {
      running.push("two")
      await second.gate
      return 2
    },
  },
})
await Promise.resolve()
if (running.join() !== "one,two") fail(`steps ran one after another: ${running.join()}`)
second.open()
first.open()
const values = await together
if (values.one !== 1 || values.two !== 2) fail(`values were ${JSON.stringify(values)}`)

const routes = opened()
const order = []
const waited = runSteps({
  routes: {
    run: async () => {
      await routes.gate
      order.push("routes written")
      return ["a.pptx", "b.pptx"]
    },
  },
  renders: {
    run: async () => {
      order.push("renders started")
      return "pages"
    },
  },
  validator: {
    after: ["routes"],
    run: async ({ routes: files }) => {
      order.push(`validator judged ${files.join(" ")}`)
      return files.length
    },
  },
})
await new Promise((resolve) => setTimeout(resolve, 10))
if (order.includes("validator judged a.pptx b.pptx")) fail("the validator ran before its files were written")
if (!order.includes("renders started")) fail("renders waited on route writes")
routes.open()
const judged = await waited
if (order.join("; ") !== "renders started; routes written; validator judged a.pptx b.pptx") fail(order.join("; "))
if (judged.validator !== 2 || judged.renders !== "pages") fail(JSON.stringify(judged))

let skippedRan = false
let lateFinished = false
const failing = await runSteps({
  routes: { run: async () => fail("route write broke") },
  renders: {
    run: async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      lateFinished = true
      fail("render broke")
    },
  },
  spec: { run: () => fail("spec broke") },
  validator: {
    after: ["routes"],
    run: async () => {
      skippedRan = true
    },
  },
}).then(
  () => undefined,
  (error) => error,
)
if (!(failing instanceof AggregateError)) fail("failed steps passed")
if (!lateFinished) fail("the run ended before every step settled")
if (skippedRan) fail("a step ran after the step it waits on failed")
if (failing.errors.length !== 3) fail(`${failing.errors.length} failures surfaced, not 3`)
for (const message of ["routes: route write broke", "renders: render broke", "spec: spec broke"]) {
  if (!failing.message.includes(message)) fail(`${message} is missing from ${failing.message}`)
}
if (failing.message.includes("validator")) fail("a skipped step was reported as a failure")

const misordered = await runSteps({
  validator: { after: ["routes"], run: () => 1 },
  routes: { run: () => 2 },
}).then(
  () => undefined,
  (error) => error,
)
if (misordered === undefined || !misordered.message.includes("validator waits on routes")) {
  fail("a step waited on a step listed after it")
}

console.log("run steps tests passed")
