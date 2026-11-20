import { elementId, slideId } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { readAddChange } from "./set-wire.js"

describe("readAddChange reads a new line or arrow on one slide", () => {
  const ends = { start: { shape: { node: "258.2", site: 3 } }, end: { shape: { node: "258.3", site: 1 } } }
  const bound = {
    start: { shape: { node: elementId("258.2"), site: 3 } },
    end: { shape: { node: elementId("258.3"), site: 1 } },
  }

  it("reads an arrow whose ends attach to two shapes with no box, and a line with a box zero points high", () => {
    expect(readAddChange({ op: "add", kind: "arrow", slide: "258", connection: ends })).toEqual({
      ok: true,
      change: { op: "add", kind: "arrow", slide: slideId("258"), connection: bound },
    })
    expect(readAddChange({ op: "add", kind: "line", slide: "258", box: { x: 72, y: 72, w: 144, h: 0 } })).toEqual({
      ok: true,
      change: { op: "add", kind: "line", slide: slideId("258"), box: { x: 914_400, y: 914_400, cx: 1_828_800, cy: 0 } },
    })
  })

  it("wants a box unless both ends attach, a line longer than a point, and neither text nor an icon", () => {
    const line = { op: "add", kind: "line", slide: "258" }
    const refused = (field: string) => ({ ok: false, refusal: "field", field })
    expect(readAddChange(line)).toEqual(refused("box"))
    expect(readAddChange({ ...line, connection: { start: ends.start } })).toEqual(refused("box"))
    expect(readAddChange({ ...line, box: { x: 72, y: 72, w: 0, h: 0 } })).toEqual(refused("box"))
    expect(readAddChange({ ...line, connection: ends, text: { value: "x" } })).toEqual(refused("text"))
    expect(readAddChange({ ...line, connection: ends, icon: "rocket" })).toEqual(refused("icon"))
    expect(readAddChange({ ...line, kind: "shape", connection: ends })).toEqual(refused("connection"))
  })
})
