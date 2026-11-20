import { describe, expect, it } from "vitest"
import { deviceRows, valuedKey } from "./device-rows"

const account = "0123456789abcdef0123456789abcdef"
const deck = "d_chart1"
const at = (tail: string) => `${account}\u0005${deck}${tail}`

describe("the device rows a failed browser test keeps", () => {
  it("reads the value of each row, head, revision and aside slot, and only the name of the others", () => {
    for (const tail of ["\u0000c\u0000000000000003", "\u0000p\u0000000000000007", "\u0002head", "\u0002revision"])
      expect(valuedKey.test(at(tail))).toBe(true)
    expect(valuedKey.test(at("\u0003aside"))).toBe(true)
    expect(valuedKey.test(at("\u0002sectionStarts"))).toBe(true)
    for (const tail of ["\u0001", "\u0003original", "\u0003media", "\u0003pictures", "\u0004"])
      expect(valuedKey.test(at(tail))).toBe(false)
    expect(valuedKey.test(`${account}\u0005\u0007seen`)).toBe(false)
  })

  it("groups confirmed and pending rows, the head, revision and unsaved shelf under their deck, in key order", () => {
    const navy = { kind: "pending", deck, order: 7, base: 6, node: "258.2", v: 1, value: '{"fill":"1F4E79"}' }
    const gap = { kind: "pending", deck, order: 6, base: 5, node: "258.2", v: 1, value: '{"gap":40}' }
    const confirmed = { kind: "confirmed", deck, revision: 1, node: "258.2", value: "x" }
    const unsaved = [{ id: "u1", kind: "row", node: "258.2", floor: "f", row: { v: 1, patch: {} } }]
    const rows = deviceRows({
      rows: [
        { key: at("\u0000p\u0000000000000007"), value: navy },
        { key: at("\u0000p\u0000000000000006"), value: gap },
        { key: at("\u0000c\u0000000000000001"), value: confirmed },
        { key: at("\u0002revision"), value: 5 },
        { key: at("\u0002head"), value: 8 },
        { key: at("\u0001") },
        { key: `${account}\u0005\u0007seen` },
      ],
      shelf: {
        [`airdesign:unsaved:${account}:${deck}`]: JSON.stringify(unsaved),
        [`airdesign:queued:${account}:${deck}\u0003name`]: "not json",
      },
    })
    expect(rows.decks).toEqual([
      {
        account,
        deck,
        revision: 5,
        head: 8,
        confirmed: [confirmed],
        pending: [gap, navy],
        unsaved,
        slots: ["\\u0001"],
      },
    ])
    expect(rows.device).toEqual({
      slots: [`${account}\\u0005\\u0007seen`],
      shelf: { [`airdesign:queued:${account}:${deck}\\u0003name`]: "not json" },
    })
  })

  it("keeps a deck whose only trace is an unsaved shelf entry", () => {
    const rows = deviceRows({ rows: [], shelf: { [`airdesign:unsaved:${account}:${deck}`]: "[]" } })
    expect(rows.decks).toEqual([{ account, deck, confirmed: [], pending: [], unsaved: [], slots: [] }])
  })
})
