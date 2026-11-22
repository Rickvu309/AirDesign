import { describe, expect, it } from "vitest"
import { offsetOfPlace, placeOfOffset } from "./text-caret"

const moduleName = "jsdom"
const jsdom = (await import(moduleName)) as {
  JSDOM: new (html: string) => { window: Window & typeof globalThis }
}

function host(): { readonly host: HTMLElement; readonly lines: readonly HTMLElement[] } {
  const { window } = new jsdom.JSDOM(`<div id="host">
    <div data-line data-start="0" data-end="10"><span data-label>•</span><span data-run>Hello </span><span data-run>bold</span></div>
    <div data-line data-start="11" data-end="11"><br></div>
    <div data-line data-start="12" data-end="15"><span data-run>end</span></div>
  </div>`)
  const root = window.document.getElementById("host")!
  return { host: root, lines: [...root.querySelectorAll<HTMLElement>("[data-line]")] }
}

describe("a place in the editor and a character offset", () => {
  it("counts the characters of earlier runs and skips the list marker", () => {
    const { host: root, lines } = host()
    const bold = lines[0]!.querySelectorAll("[data-run]")[1]!.firstChild!
    expect(offsetOfPlace(root, { node: bold, at: 2 })).toBe(8)
    const first = lines[0]!.querySelectorAll("[data-run]")[0]!.firstChild!
    expect(offsetOfPlace(root, { node: first, at: 0 })).toBe(0)
  })

  it("reads a place between a line's children and the host's own children", () => {
    const { host: root, lines } = host()
    expect(offsetOfPlace(root, { node: lines[0]!, at: 3 })).toBe(10)
    expect(offsetOfPlace(root, { node: root, at: 2 })).toBe(12)
    expect(offsetOfPlace(root, { node: root, at: 99 })).toBe(15)
    expect(offsetOfPlace(root, { node: lines[1]!, at: 0 })).toBe(11)
  })

  it("puts an offset into the right run, and on an empty line", () => {
    const { host: root, lines } = host()
    const bold = lines[0]!.querySelectorAll("[data-run]")[1]!.firstChild!
    expect(placeOfOffset(root, 8)).toEqual({ node: bold, at: 2 })
    expect(placeOfOffset(root, 11)?.node).toBe(lines[1])
    expect(placeOfOffset(root, 13)?.at).toBe(1)
  })

  it("clamps past the last visible character, and every offset goes round trip", () => {
    const { host: root } = host()
    expect(placeOfOffset(root, 10)?.at).toBe(4)
    for (const offset of [0, 3, 6, 10, 11, 12, 14, 15]) {
      expect(offsetOfPlace(root, placeOfOffset(root, offset)!)).toBe(offset)
    }
  })
})
