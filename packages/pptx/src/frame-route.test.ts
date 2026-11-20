import {
  changeLayout,
  elementGone,
  groupParent,
  slideUndoable,
  undoOf,
  openRegister,
  ungroupTurn,
  type Register,
} from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { exportParts, indexPackage, readShapes } from "./index.js"
import { decodeUtf8 } from "./package-bytes.js"
import {
  body,
  exported,
  file,
  gapped,
  node,
  opened,
  painted,
  part,
  ran,
  slide,
  slideCommand,
  wrapCommand,
  wrapped,
} from "./frame-deck.js"

describe("auto layout frame export", () => {
  it("writes the frame as a group with a blank backdrop first and its children laid out in a row", () => {
    const shown = exported(wrapped(opened))
    expect(painted(shown, 3)).toMatchObject({ x: 100000, y: 100000, width: 200000, height: 100000 })
    expect(painted(shown, 5)).toMatchObject({ x: 401600, y: 100000, width: 100000, height: 100000 })
    expect(painted(shown, 21)).toMatchObject({ x: 100000, y: 100000, width: 401600, height: 100000 })
    const text = decodeUtf8(shown.get(part) ?? new Uint8Array())
    expect(text).toContain(
      '<p:cNvPr id="20" name="Frame 20"/><p:cNvGrpSpPr/><p:nvPr><p:custDataLst><p:tags xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></p:custDataLst></p:nvPr></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="401600" cy="100000"/><a:chOff x="100000" y="100000"/><a:chExt cx="401600" cy="100000"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="21" name="Backdrop 21"/>',
    )
    expect(text).toContain("<a:noFill/><a:ln><a:noFill/></a:ln>")
    const read = readShapes(shown).filter((each) => ["3", "5", "21"].includes(each.shape))
    expect(read.map((each) => [each.shape, each.group ?? null])).toEqual([
      ["21", "20"],
      ["3", "20"],
      ["5", "20"],
    ])
  })

  it("moves the later child and widens the frame when the gap changes", () => {
    const shown = exported(gapped(wrapped(opened), 50000))
    expect(painted(shown, 5).x).toBe(350000)
    expect(painted(shown, 21).width).toBe(350000)
  })

  it("ungroups with every child where the layout put it and the backdrop gone", () => {
    const before = gapped(wrapped(opened), 50000)
    const turn = ungroupTurn(before, file, slide, node(20))
    if (turn === null) throw new Error("ungroup")
    const after = exported(ran(before, turn))
    expect(painted(after, 5).x).toBe(350000)
    const text = decodeUtf8(after.get(part) ?? new Uint8Array())
    expect(text).not.toContain('<p:grpSp><p:nvGrpSpPr><p:cNvPr id="20"')
    expect(text).not.toContain('id="21"')
  })

  it("gives back the file's slide byte for byte when the wrap is undone", () => {
    const command = wrapCommand(opened, [4, 5])
    const undoable = slideUndoable(opened, file, command)
    if (undoable === null) throw new Error("undoable")
    const after = ran(opened, [slideCommand(command)])
    const undone = undoOf(after, undoable)
    if (!undone.ok) throw new Error("undo")
    expect(decodeUtf8(exported(ran(after, undone.commands)).get(part) ?? new Uint8Array())).toBe(body)
  })
})

describe("auto layout frame members export", () => {
  it("moves a joined shape into the frame's group at its flow place, and a leaving one out after the group", () => {
    const framed = wrapped(opened)
    const join = changeLayout(framed, { place: node(4), box: { x: 250000, y: 100000, cx: 10000, cy: 10000 }, file })
    if (join === null || !("turn" in join)) throw new Error("join")
    const joined = ran(framed, join.turn)
    const text = decodeUtf8(exported(joined).get(part) ?? new Uint8Array())
    const at = (shape: number) => text.indexOf(`<p:cNvPr id="${shape}"`)
    expect(
      [at(21), at(3), at(4), at(5)].every((value, index, all) => index === 0 || value > (all[index - 1] ?? 0)),
    ).toBe(true)
    expect(text.indexOf("</p:grpSp>")).toBeGreaterThan(at(5))
    expect(painted(exported(joined), 4).x).toBe(401600)
    const leave = changeLayout(joined, {
      place: node(3),
      box: { x: 3000000, y: 3000000, cx: 200000, cy: 100000 },
      file,
    })
    if (leave === null || !("turn" in leave)) throw new Error("leave")
    const left = exported(ran(joined, leave.turn))
    const after = decodeUtf8(left.get(part) ?? new Uint8Array())
    expect(after.indexOf('<p:cNvPr id="3"')).toBeGreaterThan(after.indexOf("</p:grpSp>"))
    expect(painted(left, 3)).toMatchObject({ x: 3000000, y: 3000000 })
    expect(painted(left, 4).x).toBe(100000)
  })

  it("lays the frame out without a deleted child", () => {
    const framed = wrapped(opened)
    const removed = ran(framed, [slideCommand({ slide: "element-remove", id: slide, node: node(3) })])
    const shown = exported(removed)
    expect(decodeUtf8(shown.get(part) ?? new Uint8Array())).not.toContain('<p:cNvPr id="3"')
    expect(painted(shown, 5).x).toBe(100000)
  })
})

describe("auto layout frame of added shapes", () => {
  it("keeps the frame when one of its added shapes is deleted", () => {
    const added = [30, 31].map((shape, at) => ({
      node: node(shape),
      kind: "shape" as const,
      value: "",
      box: { x: 1_000_000 + at * 600_000, y: 1_000_000, cx: 400_000, cy: 300_000 },
      grouped: false,
    }))
    const made = ran(
      opened,
      added.map((element) => slideCommand({ slide: "element-add", id: slide, element })),
    )
    const changed = changeLayout(made, { wrap: [node(30), node(31)], slide, node: node(32), backdrop: node(33) })
    if (changed === null || !("slide" in changed)) throw new Error("wrap")
    const framed = ran(made, [slideCommand(changed.slide)])
    const removed = ran(framed, [slideCommand({ slide: "element-remove", id: slide, node: node(31) })])
    const text = decodeUtf8(exported(removed).get(part) ?? new Uint8Array())
    expect(text).toContain('<p:cNvPr id="32" name="Frame 32"/>')
    expect(text).toContain('<p:cNvPr id="30"')
    expect(text).not.toContain('<p:cNvPr id="31"')
  })
})

describe("auto layout frame in PowerPoint", () => {
  const exportedFrame = () => exported(gapped(wrapped(opened), 50000))
  const reread = (shown: ReadonlyMap<string, Uint8Array>) =>
    indexPackage(shown).elements.find((element) => element.node === node(20))
  const edited = (shown: ReadonlyMap<string, Uint8Array>, change: (text: string) => string) =>
    new Map([
      ...shown,
      [
        part,
        Uint8Array.from(change(decodeUtf8(shown.get(part) ?? new Uint8Array())), (letter) => letter.charCodeAt(0)),
      ],
    ])

  it("writes a tag that reads back as the same auto layout frame, with its fields, backdrop and flow", () => {
    const shown = exportedFrame()
    expect([...shown.keys()].filter((name) => name.startsWith("ppt/tags/"))).toEqual(["ppt/tags/tag1.xml"])
    expect(decodeUtf8(shown.get("[Content_Types].xml") ?? new Uint8Array())).toContain('PartName="/ppt/tags/tag1.xml"')
    expect(decodeUtf8(shown.get(part) ?? new Uint8Array())).toContain("<p:custDataLst><p:tags")
    expect(reread(shown)?.framing).toEqual({
      backdrop: node(21),
      children: [node(3), node(5)],
      layout: { flow: "horizontal", gap: 50000, padding: [0, 0, 0, 0], align: "topLeft" },
    })
    expect(
      exportParts(shown, { ...openRegister("", ""), index: { ...indexPackage(shown), total: 0, pages: [] } }),
    ).toBe(shown)
  })

  it("reads a frame whose child moved in PowerPoint as a frame without auto layout, a lost backdrop as a group", () => {
    const shown = exportedFrame()
    const moved = edited(shown, (text) =>
      text.replace('<a:off x="350000" y="100000"/>', '<a:off x="350000" y="900000"/>'),
    )
    expect(reread(moved)?.framing).toMatchObject({ children: [node(3), node(5)], layout: { flow: "none", gap: 50000 } })
    const lost = edited(shown, (text) => text.replace(/<p:sp><p:nvSpPr><p:cNvPr id="21"[\s\S]*?<\/p:sp>/, ""))
    expect(reread(lost)?.framing).toBeUndefined()
    const scaled = edited(shown, (text) =>
      text.replace(/<a:chExt cx="(\d+)"/, (_, cx) => `<a:chExt cx="${Number(cx) * 2}"`),
    )
    expect(reread(scaled)?.framing).toBeUndefined()
  })
})

describe("a frame inside an auto layout frame in PowerPoint", () => {
  function nested(): Register {
    const inner = gapped(wrapped(opened), 50000)
    const changed = changeLayout(inner, { wrap: [node(20), node(4)], slide, node: node(22), backdrop: node(23) })
    if (changed === null || !("slide" in changed)) throw new Error("wrap")
    const outer = ran(inner, [slideCommand(changed.slide)])
    return ran(outer, [{ command: "person", v: 13, patch: { layout: { gap: { set: 20000 } } }, node: node(22) }])
  }

  it("writes the inner frame's group inside the outer one, each child where the two layouts put it", () => {
    const shown = exported(nested())
    expect(painted(shown, 4)).toMatchObject({ x: 50000, y: 50000, width: 10000, height: 10000 })
    expect(painted(shown, 21)).toMatchObject({ x: 80000, y: 50000, width: 350000, height: 100000 })
    expect(painted(shown, 3)).toMatchObject({ x: 80000, y: 50000, width: 200000, height: 100000 })
    expect(painted(shown, 5)).toMatchObject({ x: 330000, y: 50000, width: 100000, height: 100000 })
    expect(painted(shown, 23)).toMatchObject({ x: 50000, y: 50000, width: 380000, height: 100000 })
    const groups = readShapes(shown).filter((each) => ["4", "20", "21", "3", "5", "23"].includes(each.shape))
    expect(groups.map((each) => [each.shape, each.group ?? null])).toEqual([
      ["23", "22"],
      ["4", "22"],
      ["20", "22"],
      ["21", "20"],
      ["3", "20"],
      ["5", "20"],
    ])
  })

  it("reads both frames back from their tags, and gives the same bytes back untouched", () => {
    const shown = exported(nested())
    const reread = indexPackage(shown).elements
    expect(reread.find((element) => element.node === node(22))?.framing).toEqual({
      backdrop: node(23),
      children: [node(4), node(20)],
      layout: { flow: "horizontal", gap: 20000, padding: [0, 0, 0, 0], align: "topLeft" },
    })
    expect(reread.find((element) => element.node === node(20))?.framing).toEqual({
      backdrop: node(21),
      children: [node(3), node(5)],
      layout: { flow: "horizontal", gap: 50000, padding: [0, 0, 0, 0], align: "topLeft" },
    })
    expect(
      exportParts(shown, { ...openRegister("", ""), index: { ...indexPackage(shown), total: 0, pages: [] } }),
    ).toBe(shown)
  })

  it("writes a shape dropped into the inner frame at its place in the inner row", () => {
    const element = {
      node: node(30),
      kind: "shape" as const,
      value: "",
      box: { x: 2_000_000, y: 2_000_000, cx: 100000, cy: 100000 },
      grouped: false,
    }
    const before = ran(nested(), [slideCommand({ slide: "element-add", id: slide, element })])
    const join = changeLayout(before, { place: node(30), box: { x: 250000, y: 60000, cx: 100000, cy: 100000 }, file })
    if (join === null || !("turn" in join)) throw new Error("join")
    expect(join.turn[0]).toMatchObject({
      command: "slide",
      edit: { slide: "element-join", frame: node(20), before: node(5) },
    })
    const shown = exported(ran(before, join.turn))
    expect(painted(shown, 3)).toMatchObject({ x: 80000, y: 50000 })
    expect(painted(shown, 30)).toMatchObject({ x: 330000, y: 50000, width: 100000, height: 100000 })
    expect(painted(shown, 5)).toMatchObject({ x: 480000, y: 50000 })
  })

  it("moves the outer frame's next child when the inner frame's gap grows", () => {
    const shown = exported(gapped(nested(), 150000))
    expect(painted(shown, 5).x).toBe(430000)
    expect(painted(shown, 23).width).toBe(480000)
  })
})

describe("Shift+A on children of an auto layout frame in PowerPoint", () => {
  it("writes the new frame's group inside the outer frame's at their place, every layer where it showed", () => {
    const outer = gapped(ran(opened, [slideCommand(wrapCommand(opened, [3, 5, 4]))]), 50800)
    const changed = changeLayout(outer, { wrap: [node(5), node(3)], slide, node: node(22), backdrop: node(23) })
    if (changed === null || !("slide" in changed)) throw new Error("wrap")
    const before = exported(outer)
    const shown = exported(ran(outer, [slideCommand(changed.slide)]))
    for (const shape of [3, 4, 5]) expect(painted(shown, shape)).toEqual(painted(before, shape))
    const groups = readShapes(shown).filter((each) => ["3", "4", "5", "22"].includes(each.shape))
    expect(new Map(groups.map((each) => [each.shape, each.group ?? null]))).toEqual(
      new Map([
        ["4", "20"],
        ["22", "20"],
        ["3", "22"],
        ["5", "22"],
      ]),
    )
    const reread = new Map(indexPackage(shown).elements.map((element) => [element.node, element.framing]))
    expect(reread.get(node(20))?.children).toEqual([node(4), node(22)])
    expect(reread.get(node(22))?.children).toEqual([node(3), node(5)])
  })
})

describe("a wrap replayed over an index read from the parts it already wrote", () => {
  function reindexed(register: Register): Register {
    const shown = exported(register)
    const { slides: read, elements: filed } = indexPackage(shown)
    return { ...register, index: { total: filed.length, slides: read, elements: filed, pages: [] } }
  }

  it("keeps a top-level frame at the top and its children in it, with no group holding itself", () => {
    const after = reindexed(wrapped(opened))
    expect(groupParent(after, node(20))).toBeNull()
    expect(groupParent(after, node(3))).toBe(node(20))
    expect(elementGone(after, node(3))).toBe(false)
  })

  it("keeps a frame made inside a frame in its parent", () => {
    const outer = gapped(ran(opened, [slideCommand(wrapCommand(opened, [3, 5, 4]))]), 50800)
    const changed = changeLayout(outer, { wrap: [node(5), node(3)], slide, node: node(22), backdrop: node(23) })
    if (changed === null || !("slide" in changed)) throw new Error("wrap")
    const after = reindexed(ran(outer, [slideCommand(changed.slide)]))
    expect(groupParent(after, node(22))).toBe(node(20))
    expect(groupParent(after, node(3))).toBe(node(22))
    expect(elementGone(after, node(3))).toBe(false)
  })
})

describe("a fixed-width auto layout frame in PowerPoint", () => {
  const fixedFrame = () =>
    ran(gapped(wrapped(opened), 50800), [
      {
        command: "person",
        v: 13,
        patch: { layout: { width: { set: "fixed" }, align: { set: "top" } }, box: { w: { set: 1_000_000 } } },
        node: node(20),
      },
    ])

  it("writes the frame at its fixed width with the row centred along it, and reads Fixed back from its tag", () => {
    const shown = exported(fixedFrame())
    expect(painted(shown, 21)).toMatchObject({ x: 100000, width: 1_000_000 })
    expect(painted(shown, 3).x).toBe(100000 + (1_000_000 - 350800) / 2)
    expect(decodeUtf8(shown.get("ppt/tags/tag1.xml") ?? new Uint8Array())).toContain(";a=top;w=f;")
    const reread = indexPackage(shown).elements.find((element) => element.node === node(20))
    expect(reread?.framing?.layout).toMatchObject({ align: "top", width: "fixed" })
    expect(reread?.framing?.layout.height).toBeUndefined()
    expect(
      exportParts(shown, { ...openRegister("", ""), index: { ...indexPackage(shown), total: 0, pages: [] } }),
    ).toBe(shown)
  })
})
