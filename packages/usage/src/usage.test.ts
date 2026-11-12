import { describe, expect, it } from "vitest"
import { openLedger, usage } from "./index.js"

describe("usage", () => {
  it("charges one of each token and one search", () => {
    const reserved = usage(openLedger(), {
      command: "reserve",
      id: "row",
      input: 1,
      maxTokens: 1,
      coldPrefix: 1,
      search: 1,
      searchOn: true,
      usOnly: false,
    })
    expect(reserved.accepted).toBe(true)
    const settled = usage(reserved.ledger, {
      command: "settle",
      id: "row",
      input: 1,
      output: 1,
      write5m: 1,
      write1h: 1,
      read: 1,
      search: 1,
      searchOn: true,
      usOnly: false,
    })
    expect(settled.accepted).toBe(true)
    expect(settled.ledger.spent).toBe(10_018_600)

    const reservedUs = usage(openLedger(), {
      command: "reserve",
      id: "row",
      input: 1,
      maxTokens: 1,
      coldPrefix: 1,
      search: 1,
      searchOn: true,
      usOnly: true,
    })
    expect(reservedUs.accepted).toBe(true)
    const settledUs = usage(reservedUs.ledger, {
      command: "settle",
      id: "row",
      input: 1,
      output: 1,
      write5m: 1,
      write1h: 1,
      read: 1,
      search: 1,
      searchOn: true,
      usOnly: true,
    })
    expect(settledUs.accepted).toBe(true)
    expect(settledUs.ledger.spent).toBe(10_020_460)
  })

  it("holds the reserve on the open turn and clears both together", () => {
    const reserved = usage(openLedger(), {
      command: "reserve",
      id: "row",
      input: 1,
      maxTokens: 0,
      coldPrefix: 0,
      search: 0,
      searchOn: false,
      usOnly: false,
    })
    expect(reserved.ledger.open).toEqual({ turn: "row", hold: 2_000 })
    const released = usage(reserved.ledger, { command: "release", id: "row" })
    expect(released.ledger.open).toBeNull()
  })
})

describe("a stopped turn", () => {
  const reserve = {
    command: "reserve",
    id: "row",
    input: 1,
    maxTokens: 1,
    coldPrefix: 0,
    search: 0,
    searchOn: false,
    usOnly: false,
  } as const
  const stop = (id: string, input: number, output: number) =>
    ({
      command: "stop",
      id,
      input,
      output,
      write5m: 0,
      write1h: 0,
      read: 0,
      search: 0,
      searchOn: false,
      usOnly: false,
    }) as const

  it("is charged what it reported, never more than its reserve, and closes", () => {
    const reserved = usage(openLedger(), reserve).ledger
    expect(reserved.open).toEqual({ turn: "row", hold: 12_000 })
    expect(usage(reserved, stop("row", 0, 1))).toEqual({
      accepted: true,
      ledger: { ...reserved, spent: 10_000, open: null },
    })
    expect(usage(reserved, stop("row", 1, 1)).ledger.spent).toBe(12_000)
    expect(usage(reserved, stop("row", 9, 9)).ledger.spent).toBe(12_000)
  })

  it("is charged once, and a stop of another turn changes nothing", () => {
    const reserved = usage(openLedger(), reserve).ledger
    expect(usage(reserved, stop("other", 1, 1))).toEqual({ accepted: false, ledger: reserved })
    const stopped = usage(reserved, stop("row", 1, 1)).ledger
    expect(usage(stopped, stop("row", 1, 1))).toEqual({ accepted: false, ledger: stopped })
    expect(usage(stopped, { ...stop("row", 1, 1), command: "settle" })).toEqual({ accepted: false, ledger: stopped })
  })
})
