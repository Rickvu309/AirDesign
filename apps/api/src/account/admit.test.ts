import { describe, expect, it } from "vitest"
import { admit, emptyLog, type CallerLog, type LimitKind } from "./admit.js"

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

  it("allows the ninetieth tool call and refuses the ninety-first", () => {
    const called = take(emptyLog(), "tool", 90, (index) => index)
    const refused = admit(called, "tool", 89)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.log).toBe(called)
    expect(refused.log.events).toHaveLength(90)
    expect(refused.resetsAt).toBe(300_000)
    expect(refused.text).toBe("Ninety tool calls in five minutes. The next tool call can run in 300 seconds.")
    const next = admit(called, "tool", 300_000)
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.log.events).toHaveLength(90)
    expect(called.events).toHaveLength(90)
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
    const filled = take(emptyLog(), "tool", 90, () => 5_000_000)
    const refused = admit(filled, "tool", 5_000_000)
    expect(refused.ok).toBe(false)
    if (refused.ok) return
    expect(refused.log.events).toHaveLength(90)
    expect(refused.text).toBe("Ninety tool calls in five minutes. The next tool call can run in 300 seconds.")
  })

  it("gives each agent its own ninety tool calls and refuses the account's three hundred and first", () => {
    let log = emptyLog()
    for (const [agent, calls] of [
      ["one", 90],
      ["two", 90],
      ["three", 90],
      ["four", 30],
    ] as const) {
      for (let call = 0; call < calls; call += 1) {
        const admitted = admit(log, "tool", call, agent)
        if (!admitted.ok) throw new Error(admitted.text)
        log = admitted.log
      }
      if (calls < 90) continue
      const full = admit(log, "tool", 90, agent)
      expect(full.ok).toBe(false)
      if (full.ok) return
      expect(full.text).toBe("Ninety tool calls in five minutes. The next tool call can run in 300 seconds.")
    }
    const fifth = admit(log, "tool", 95, "five")
    expect(fifth.ok).toBe(false)
    if (fifth.ok) return
    expect(fifth.log).toBe(log)
    expect(fifth.resetsAt).toBe(300_000)
    expect(fifth.text).toBe(
      "Three hundred tool calls in five minutes from this account's agents. The next tool call can run in 300 seconds.",
    )
    expect(admit(log, "tool", 300_000, "five").ok).toBe(true)
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
