import { act } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { cell, clipboardEvent, id, mounted, pasteEvent, pressed, selected, unmountAll } from "./table-canvas-fixture.js"

afterEach(unmountAll)

describe("SlideCanvas table clipboard", () => {
  it("fills cells from the one being typed in when a block of cells is pasted, and leaves one value to the cell", async () => {
    const { host, changes } = await mounted(id)
    const block = pasteEvent({ "text/plain": "a\tb\nc\td\n" })
    await act(async () => cell(host, "0.0").dispatchEvent(block))
    expect(block.defaultPrevented).toBe(true)
    const one = pasteEvent({ "text/plain": "North" })
    await act(async () => cell(host, "0.0").dispatchEvent(one))
    expect(one.defaultPrevented).toBe(false)
    expect(changes).toEqual([
      {
        change: "paste",
        row: 0,
        column: 0,
        cells: [
          ["a", "b"],
          ["c", "d"],
        ],
      },
    ])
  })

  it("pastes into the picked cells from their first, and copies or cuts them as tab-separated text", async () => {
    const { host, changes } = await mounted(null, {}, 3)
    const at = (spot: string) => {
      const found = host.querySelector<HTMLElement>(`[data-table-cell="${spot}"]`)
      if (found === null) throw new Error(spot)
      return found
    }
    await pressed(at("1.1"))
    await pressed(at("1.1"))
    await pressed(at("1.2"), true)
    const frame = host.querySelector<HTMLElement>("[data-canvas-table]")
    if (frame === null) throw new Error("table")
    const paste = pasteEvent({ "text/plain": "7" })
    await act(async () => frame.dispatchEvent(paste))
    expect(paste.defaultPrevented).toBe(true)
    const copy = clipboardEvent("copy")
    await act(async () => frame.dispatchEvent(copy.event))
    expect(copy.event.defaultPrevented).toBe(true)
    expect(copy.items.get("text/plain")).toBe("\t")
    expect(copy.items.get("text/html")).toContain("<table>")
    const cut = clipboardEvent("cut")
    await act(async () => frame.dispatchEvent(cut.event))
    expect(changes).toEqual([
      { change: "paste", row: 1, column: 1, cells: [["7"]] },
      { change: "clear", cells: { rows: [1, 1], columns: [1, 2] } },
    ])
  })

  it("leaves a paste and a copy to the slide when the whole table is selected", async () => {
    const { host, changes } = await mounted(null)
    const frame = await selected(host)
    const paste = pasteEvent({ "text/plain": "a\tb" })
    await act(async () => frame.dispatchEvent(paste))
    const copy = clipboardEvent("copy")
    await act(async () => frame.dispatchEvent(copy.event))
    expect(paste.defaultPrevented).toBe(false)
    expect(copy.event.defaultPrevented).toBe(false)
    expect(changes).toEqual([])
  })
})
