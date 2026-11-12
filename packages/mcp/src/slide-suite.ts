import { fixture } from "./fixture.js"
import type { SuiteRow } from "./suite.js"

export const slideSuite: readonly SuiteRow[] = (
  [
    ["add_slide", { after: "258", layout: "258" }, ["258", "260", "259"]],
    ["duplicate_slide", { slide: "258" }, ["258", "260", "259"]],
    ["delete_slide", { slide: "258" }, ["259"]],
    ["move_slide", { slide: "259", after: null }, ["259", "258"]],
  ] as const
).map(([op, input, slides]) => ({
  task: {
    id: String(op),
    prompt: `Use airdesign_${String(op)} to change the slide order.`,
    deck: () =>
      fixture("slides", [], (register) => ({
        ...register,
        index: {
          total: 0,
          slides: [
            { id: "258", position: 0, layout: [] },
            { id: "259", position: 1, layout: [] },
          ],
          elements: [],
          pages: [],
        },
      })),
    want: { calls: 1, steps: [{ name: op, outcome: "ok" }], elements: {}, slides },
  },
  reference: [{ name: `airdesign_${op}`, raw: { deck: "slides", base: 0, ...input } }],
  wrong: { attempt: [{ name: `airdesign_${op}`, raw: { deck: "slides", base: 9, ...input } }], reason: "tool" },
}))
