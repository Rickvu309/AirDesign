import { describe, expect, it } from "vitest"
import { admit, emptyLog, refund, type CallerLog, type LimitKind } from "./index.js"

function take(log: CallerLog, kind: LimitKind, count: number, at: (index: number) => number): CallerLog {
  let current = log
  for (let index = 0; index < count; index += 1) {
    const result = admit(current, kind, at(index))
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(result.text)
    expect(result.log).not.toBe(current)
    expect(current.events).toHaveLength(index)
    current = result.log
  }
  expect(current.events).toHaveLength(count)
  return current
}

describe("admit", () => {
  it("allows the fifth deck in a minute and refuses the sixth", () => {
    const opened = take(emptyLog(), "deck", 5, (index) => index * 10)
    const refused = admit(opened, "deck", 50)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.log).toBe(opened)
    expect(refused.log.events).toHaveLength(5)
    expect(refused.resetsAt).toBe(60_000)
    expect(refused.text).toBe("Five decks in one minute. The next deck can open in 60 seconds.")
    const next = admit(opened, "deck", 60_000)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.log.events).toHaveLength(5)
    expect(opened.events).toHaveLength(5)
  })

  it("allows the thirtieth tool call and refuses the thirty-first", () => {
    const called = take(emptyLog(), "tool", 30, (index) => index)
    const refused = admit(called, "tool", 29)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.log).toBe(called)
    expect(refused.log.events).toHaveLength(30)
    expect(refused.resetsAt).toBe(300_000)
    expect(refused.text).toBe("Thirty tool calls in five minutes. The next tool call can run in 300 seconds.")
    const next = admit(called, "tool", 300_000)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.log.events).toHaveLength(30)
    expect(called.events).toHaveLength(30)
  })

  it("allows the twentieth turn and refuses the twenty-first", () => {
    const turned = take(emptyLog(), "turn", 20, (index) => index)
    const refused = admit(turned, "turn", 19)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.log).toBe(turned)
    expect(refused.log.events).toHaveLength(20)
    expect(refused.resetsAt).toBe(300_000)
    expect(refused.text).toBe("Twenty turns in five minutes. The next turn can start in 300 seconds.")
    const next = admit(turned, "turn", 300_000)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.log.events).toHaveLength(20)
    expect(turned.events).toHaveLength(20)
  })

  it("keeps five decks on one log from refusing a deck on another", () => {
    const first = take(emptyLog(), "deck", 5, () => 0)
    const second = emptyLog()
    const admitted = admit(second, "deck", 0)
    expect(admitted.ok).toBe(true)
    if (!admitted.ok) return
    expect(admitted.log).not.toBe(first)
    expect(second.events).toHaveLength(0)
    expect(admit(first, "deck", 0).ok).toBe(false)
  })

  it("drops tool events that have left the window and still refuses a full window", () => {
    let log = emptyLog()
    let now = 0
    for (let call = 0; call < 1000; call += 1) {
      const admitted = admit(log, "tool", now)
      expect(admitted.ok).toBe(true)
      if (!admitted.ok) throw new Error(admitted.text)
      log = admitted.log
      expect(log.events.length).toBeLessThanOrEqual(30)
      now += 10_000
    }
    const filled = take(emptyLog(), "tool", 30, () => 5_000_000)
    const refused = admit(filled, "tool", 5_000_000)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.log.events).toHaveLength(30)
    expect(refused.text).toBe("Thirty tool calls in five minutes. The next tool call can run in 300 seconds.")
  })

  it("gives each agent its own thirty tool calls and refuses the account's ninety-first", () => {
    let log = emptyLog()
    for (const agent of ["one", "two", "three"]) {
      for (let call = 0; call < 30; call += 1) {
        const admitted = admit(log, "tool", call, agent)
        if (!admitted.ok) throw new Error(admitted.text)
        log = admitted.log
      }
      const full = admit(log, "tool", 30, agent)
      expect(full.ok).toBe(false)
      if (full.ok) return
      expect(full.text).toBe("Thirty tool calls in five minutes. The next tool call can run in 300 seconds.")
    }
    const fourth = admit(log, "tool", 40, "four")
    expect(fourth.ok).toBe(false)
    if (fourth.ok) return
    expect(fourth.log).toBe(log)
    expect(fourth.resetsAt).toBe(300_000)
    expect(fourth.text).toBe(
      "Ninety tool calls in five minutes from this account's agents. The next tool call can run in 300 seconds.",
    )
    expect(admit(log, "tool", 300_000, "four").ok).toBe(true)
  })

  it("refunds only the agent's own latest tool call", () => {
    const first = admit(emptyLog(), "tool", 0, "one")
    if (!first.ok) throw new Error(first.text)
    const second = admit(first.log, "tool", 1, "two")
    if (!second.ok) throw new Error(second.text)
    expect(refund(second.log, "tool", "one").events).toEqual([{ kind: "tool", at: 1, agent: "two" }])
  })

  it("counts a deck apart from a tool call and a turn", () => {
    const decks = { events: Array.from({ length: 30 }, () => ({ kind: "deck" as const, at: 0 })) }
    expect(admit(decks, "tool", 0).ok).toBe(true)
    expect(admit(decks, "turn", 0).ok).toBe(true)
    const tools = { events: Array.from({ length: 30 }, () => ({ kind: "tool" as const, at: 0 })) }
    expect(admit(tools, "turn", 0).ok).toBe(true)
    expect(admit(tools, "deck", 0).ok).toBe(true)
  })
})
