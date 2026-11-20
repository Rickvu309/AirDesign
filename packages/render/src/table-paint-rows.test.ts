import { afterEach, describe, expect, it, vi } from "vitest"
import { id, mounted, pointer, selected, unmountAll } from "./table-canvas-fixture.js"

afterEach(async () => {
  vi.restoreAllMocks()
  await unmountAll()
})

function laidOut(painted: string, least = painted) {
  const real = window.getComputedStyle.bind(window)
  vi.spyOn(window, "getComputedStyle").mockImplementation((node, pseudo) => {
    const style = real(node, pseudo)
    if (!(node instanceof HTMLElement) || !node.hasAttribute("data-canvas-table")) return style
    const tracks = node.style.gridTemplateRows.includes("min-content") ? least : painted
    return new Proxy(style, {
      get: (target, name) => (name === "gridTemplateRows" ? tracks : Reflect.get(target, name)),
    })
  })
}

describe("SlideCanvas table rows", () => {
  it("grows the selection frame to the rows as painted, and keeps their heights for the export", async () => {
    laidOut("30px 45px")
    const { host, store } = await mounted(id)
    const frame = host.querySelector<HTMLElement>("[data-selection]")
    expect(frame?.style.height).toBe("75px")
    expect(store.getRows(id)).toEqual({ written: "", height: 741_680, heights: [457_200, 685_800] })
  })

  it("stops a row border drag at the text the row holds", async () => {
    laidOut("24.3333px 24.3333px", "20px 16px")
    const { host, changes } = await mounted(null)
    await selected(host)
    const border = host.querySelector<HTMLElement>('[data-row-border="0"]')
    if (border === null) throw new Error("border")
    await pointer(border, "pointerdown", 100, 60)
    await pointer(border, "pointermove", 100, 50)
    await pointer(border, "pointerup", 100, 50)
    expect(changes).toEqual([{ change: "heights", heights: [304_800, 436_880] }])
  })
})
