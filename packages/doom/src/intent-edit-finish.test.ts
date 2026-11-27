import { describe, expect, it, vi } from "vitest"
import type { Intent } from "./intent-read.js"
import { intentSession } from "./intent-edit.js"
import { land } from "./land.js"
import { type Measure, measureWith } from "./measure.js"
import { agent, ids } from "./sample-deck.js"
import { agentDeck, minter, runName } from "./testing/agent-fixtures.js"
import { placement } from "./testing/placement-rules.js"
import { starts } from "./testing/start-rules.js"

vi.mock("./land.js", async (original) => {
  const real = await original<typeof import("./land.js")>()
  return { ...real, land: vi.fn(real.land) }
})

const estimate = measureWith({})
const wide: Measure = (text, theme, width, fit) => {
  const measured = estimate(text, theme, width, fit)
  return { ...measured, w: measured.w * 1.6 }
}

function deleted(by: { readonly measure?: Measure } = {}) {
  const session = intentSession(agentDeck(), {
    author: agent(runName),
    once: "agent-1",
    mint: minter(),
    placement,
    starts,
    ...by,
  })
  const step = session.step({ op: "delete", nodes: [ids.card] } as Intent, false)
  let next = step.next()
  while (!next.done) next = step.next(estimate)
  return session
}

describe("intentSession finish", () => {
  it("lands with the measure it is given, so freed line ends follow the fonts that painted them", () => {
    vi.mocked(land).mockClear()
    expect(deleted().finish(wide)).not.toHaveProperty("refused")
    expect(vi.mocked(land).mock.calls.at(-1)?.[2].measure).toBe(wide)
  })

  it("lands with the session's own measure when it is given none", () => {
    vi.mocked(land).mockClear()
    expect(deleted({ measure: wide }).finish()).not.toHaveProperty("refused")
    expect(vi.mocked(land).mock.calls.at(-1)?.[2].measure).toBe(wide)
  })
})
