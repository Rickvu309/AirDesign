import { openRegister, readLayout } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { gapped, node, opened, ran, wrapped, exported, painted } from "./frame-deck.js"
import { exportParts, indexPackage } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"

describe("a layer that fills a fixed auto layout frame in PowerPoint", () => {
  const filledFrame = () =>
    ran(gapped(wrapped(opened), 50800), [
      {
        command: "person",
        v: 13,
        patch: { layout: { width: { set: "fixed" } }, box: { w: { set: 1_000_000 } } },
        node: node(20),
      },
      { command: "person", v: 13, patch: { layout: { width: { set: "fill" } } }, node: node(5) },
    ])

  it("writes the filling layer at the free width, keeps which layer fills in the tag, and reads it back", () => {
    const shown = exported(filledFrame())
    const first = painted(shown, 3)
    expect(painted(shown, 5)).toMatchObject({
      x: first.x + first.width + 50800,
      width: 1_000_000 - first.width - 50800,
    })
    expect(decodeUtf8(shown.get("ppt/tags/tag1.xml") ?? new Uint8Array())).toContain(";l=5:w;")
    const index = { ...indexPackage(shown), total: 0, pages: [] }
    const reread = index.elements.find((element) => element.node === node(20))
    expect(reread?.framing?.fills).toEqual([{ node: node(5), width: true, height: false }])
    const reopened = { ...openRegister("", ""), index }
    expect(readLayout(reopened, node(20))?.children.find((child) => child.node === node(5))?.fill).toEqual({
      width: true,
      height: false,
    })
    expect(exportParts(shown, reopened)).toBe(shown)
  })
})
