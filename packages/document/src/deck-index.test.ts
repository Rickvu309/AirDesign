import { describe, expect, it } from "vitest"
import {
  answeredRegister,
  appendIndex,
  designKeys,
  elementId,
  format,
  indexDue,
  indexKeys,
  limits,
  openRegister,
  readIndexPage,
  rootElement,
  roles,
  sources,
  stamps,
  type DeckIndex,
  type IndexElement,
  type IndexPage,
} from "./index.js"

const box = { x: 1, y: 2, cx: 3, cy: 4 }
const page: IndexPage = {
  once: "page-one",
  offset: 0,
  total: 2,
  slides: [
    { id: "258", position: 0 },
    { id: "259", position: 1 },
  ],
  elements: [{ node: elementId("258.7"), kind: "shape", value: "Title", box, grouped: false }],
}

describe("deck index", () => {
  it("appends immutable pages and replays a lost answer without duplicating elements", () => {
    const first = appendIndex(undefined, page)
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error(first.refusal)
    expect(first.index.elements).toHaveLength(1)
    expect(appendIndex(first.index, page)).toEqual(first)
    expect(appendIndex(first.index, { ...page, elements: [{ ...page.elements[0]!, value: "Wrong" }] })).toEqual({
      ok: false,
      refusal: "present",
    })
    const last = appendIndex(first.index, {
      ...page,
      once: "page-two",
      offset: 1,
      elements: [{ node: elementId("259.9"), kind: "picture", value: null, box: null, grouped: true }],
    })
    expect(last.ok && last.index.elements.length === last.index.total).toBe(true)
    expect(appendIndex(undefined, { ...page, once: "bad", offset: 1 })).toEqual({ ok: false, refusal: "stale" })
  })

  it("reads the slide's size, first free shape id and animated shapes, and replaces the slides of an older index", () => {
    const measured = {
      ...page,
      slides: [
        { id: "258", position: 0, size: { width: 9144000, height: 6858000 }, free: 12, animated: ["7", "9"] },
        { id: "259", position: 1, size: { width: 9144000, height: 6858000 }, free: 3, animated: [] },
      ],
    }
    expect(readIndexPage(measured)).toEqual(measured)
    for (const slide of [
      { size: { width: 0, height: 5 } },
      { size: { width: 5 } },
      { free: 0 },
      { free: 1.5 },
      { animated: ["x"] },
      { animated: ["7", "7"] },
      { animated: "7" },
    ]) {
      expect(readIndexPage({ ...page, slides: [{ ...page.slides[0], ...slide }, page.slides[1]] })).toBeNull()
    }
    const older = appendIndex(undefined, page)
    if (!older.ok) throw new Error(older.refusal)
    const upgraded = appendIndex(older.index, measured)
    expect(upgraded.ok && upgraded.index.slides).toEqual(measured.slides)
  })

  it("rejects duplicate nodes, bad slide membership, order, text, boxes, and counts", () => {
    for (const changed of [
      { total: limits.elements + 1 },
      { slides: Array.from({ length: 51 }, (_, position) => ({ id: String(position), position })) },
      { slides: [{ id: "258", position: 1 }] },
      {
        slides: [
          { id: "258", position: 0 },
          { id: "258", position: 1 },
        ],
      },
      { elements: [page.elements[0], page.elements[0]] },
      { elements: [{ ...page.elements[0], node: "260.7" }] },
      { elements: [{ ...page.elements[0], value: "x".repeat(limits.body + 1) }] },
      { elements: [{ ...page.elements[0], value: "\u0000" }] },
      { elements: [{ ...page.elements[0], box: { ...box, cx: -1 } }] },
      { elements: [{ ...page.elements[0], kind: "invented" }] },
      { actor: "person" },
    ])
      expect(readIndexPage({ ...page, ...changed })).toBeNull()
    expect(readIndexPage({ ...page, elements: [{ ...page.elements[0], value: "é".repeat(5000) }] })).not.toBeNull()
  })
})

it("adds device layout placeholders to an older index without changing its opening elements", () => {
  const first = appendIndex(undefined, page)
  if (!first.ok) throw new Error(first.refusal)
  const title = { node: elementId("258.2"), kind: "shape", value: "", box, grouped: false } as const
  const enriched = {
    ...page,
    slides: [
      { id: "258", position: 0, layout: [title] },
      { id: "259", position: 1, layout: [] },
    ],
  }
  const next = appendIndex(first.index, enriched)
  expect(next.ok).toBe(true)
  if (!next.ok) return
  expect(next.index.elements).toEqual(first.index.elements)
  expect(next.index.slides[0]?.layout).toEqual([title])
  expect(appendIndex(next.index, enriched)).toEqual(next)
  expect(
    readIndexPage({ ...enriched, slides: [{ id: "258", position: 0, layout: [{ ...title, node: "259.2" }] }] }),
  ).toBeNull()
})

describe("index format", () => {
  const second = { node: elementId("259.9"), kind: "picture", value: null, box: null, grouped: true } as const
  const stored = (() => {
    const first = appendIndex(undefined, page)
    if (!first.ok) throw new Error(first.refusal)
    const last = appendIndex(first.index, { ...page, once: "page-two", offset: 1, elements: [second] })
    if (!last.ok) throw new Error(last.refusal)
    return last.index
  })()
  const palette = {
    slots: { dk1: "000000", lt1: "FFFFFF", accent1: "4472C4" },
    map: { tx1: "dk1", bg1: "lt1" },
    fonts: { major: "Calibri Light", minor: "Calibri" },
  } as const
  const titled = {
    ...page.elements[0]!,
    role: "title",
    design: {
      fill: ["accent1", "style"],
      "text.size": [36, "master"],
      "text.font": ["+mj-lt", "master"],
      "box.flipH": [true],
    },
    kept: ["geometry"],
    placed: { x: 1, y: 2, cx: 3, cy: 4 },
  } as const
  const pictured = { ...second, role: "picture", design: { "line.width": [1, "style"] } } as const
  const resent = (offset: number, element: object, at = format): IndexPage => ({
    ...page,
    format: at,
    palettes: [palette],
    once: `again-${String(offset)}`,
    offset,
    elements: [element as IndexElement],
  })

  it("reads each element's role, design, kept and placed fields, and the page's format and palettes with their theme fonts", () => {
    const read = readIndexPage(resent(0, titled))
    expect(read).toEqual(resent(0, titled))
    for (const element of [
      { ...titled, role: "headline" },
      { ...titled, design: { "fill.color": ["accent1"] } },
      { ...titled, design: { fill: ["accent1", "file"] } },
      { ...titled, design: { fill: [] } },
      { ...titled, design: { fill: [{ scheme: "accent1" }] } },
      { ...titled, design: { fill: ["x".repeat(401)] } },
      { ...titled, kept: [] },
      { ...titled, kept: ["geometry", "geometry"] },
      { ...titled, placed: { x: 1, y: 2, cx: -3, cy: 4 } },
      { ...titled, placed: null },
    ])
      expect(readIndexPage(resent(0, element))).toBeNull()
    for (const changed of [
      { format: 0 },
      { format: format + 1 },
      { palettes: [] },
      { palettes: [{ ...palette, slots: { accent1: "blue" } }] },
      { palettes: [{ ...palette, fonts: { major: "" } }] },
      { palettes: [{ ...palette, fonts: { heading: "Georgia" } }] },
      { palettes: [{ ...palette, fonts: { minor: "x".repeat(65) } }] },
      { slides: [{ ...page.slides[0], palette: 1 }, page.slides[1]] },
    ])
      expect(readIndexPage({ ...resent(0, titled), ...changed })).toBeNull()
    expect(
      readIndexPage({ ...resent(0, titled), slides: [{ ...page.slides[0], palette: 0 }, page.slides[1]] }),
    ).not.toBeNull()
  })

  it("builds a higher-format index beside the stored one and swaps it in whole once complete", () => {
    const half = appendIndex(stored, resent(0, titled))
    if (!half.ok) throw new Error(half.refusal)
    expect(half.index.format).toBeUndefined()
    expect(half.index.elements).toEqual(stored.elements)
    expect(half.index.slides).toEqual(stored.slides)
    expect(half.index.next?.elements).toEqual([titled])
    expect(appendIndex(half.index, resent(0, titled))).toEqual(half)
    const whole = appendIndex(half.index, resent(1, pictured))
    if (!whole.ok) throw new Error(whole.refusal)
    expect(whole.index).toMatchObject({ format, palettes: [palette], elements: [titled, pictured] })
    expect(whole.index.next).toBeUndefined()
    expect(appendIndex(whole.index, resent(1, pictured))).toEqual(whole)
  })

  it("keeps the stored index when a higher-format page changes an opening value", () => {
    for (const changed of [{ value: "Another title" }, { kind: "kept" }, { box: null }, { grouped: true }])
      expect(appendIndex(stored, resent(0, { ...titled, ...changed }))).toEqual({ ok: false, refusal: "present" })
    const half = appendIndex(stored, resent(0, titled))
    if (!half.ok) throw new Error(half.refusal)
    expect(appendIndex(half.index, resent(1, { ...pictured, value: "Changed" }))).toEqual({
      ok: false,
      refusal: "present",
    })
    expect(appendIndex(stored, { ...resent(0, titled), total: 3 })).toEqual({ ok: false, refusal: "present" })
  })

  it("builds beside a partial older index too, and stores a newer index directly when none is stored", () => {
    const partial = appendIndex(undefined, page)
    if (!partial.ok) throw new Error(partial.refusal)
    expect(appendIndex(partial.index, resent(0, { ...titled, value: "Changed" }))).toEqual({
      ok: false,
      refusal: "present",
    })
    const half = appendIndex(partial.index, resent(0, titled))
    if (!half.ok) throw new Error(half.refusal)
    expect(half.index.elements).toEqual(partial.index.elements)
    const whole = appendIndex(half.index, resent(1, pictured))
    if (!whole.ok) throw new Error(whole.refusal)
    expect(whole.index).toMatchObject({ format, elements: [titled, pictured] })
    const fresh = appendIndex(undefined, resent(0, titled))
    expect(fresh.ok && fresh.index).toMatchObject({ format, elements: [titled] })
    expect(fresh.ok && fresh.index.next).toBeUndefined()
  })

  it("refuses a page below the stored index's format", () => {
    const whole = [resent(0, titled), resent(1, pictured)].reduce<DeckIndex>((index, next) => {
      const built = appendIndex(index, next)
      if (!built.ok) throw new Error(built.refusal)
      return built.index
    }, stored)
    expect(appendIndex(whole, page)).toEqual({ ok: false, refusal: "present" })
    expect(appendIndex(whole, { ...page, offset: 1, once: "late", elements: [second] })).toEqual({
      ok: false,
      refusal: "present",
    })
  })

  it("sends the index again when none is stored, it is incomplete, or its format is below this build's", () => {
    expect(format).toBe(33)
    expect(indexDue(undefined)).toBe(true)
    const first = appendIndex(undefined, page)
    if (!first.ok) throw new Error(first.refusal)
    expect(indexDue(first.index)).toBe(true)
    expect(indexDue(stored)).toBe(true)
    const whole = [resent(0, titled), resent(1, pictured)].reduce<DeckIndex>((index, next) => {
      const built = appendIndex(index, next)
      if (!built.ok) throw new Error(built.refusal)
      return built.index
    }, stored)
    expect(indexDue(whole)).toBe(false)
  })

  it("names every key the index stores, so a new key raises the index stamp", () => {
    expect({ stamp: stamps.index, keys: indexKeys }).toEqual({
      stamp: 7,
      keys: {
        page: ["format", "once", "offset", "total", "palettes", "slides", "elements"],
        palette: ["slots", "map", "fonts"],
        slide: ["id", "position", "size", "free", "animated", "layout", "palette"],
        element: ["node", "kind", "value", "box", "grouped", "role", "design", "kept", "placed", "group", "frame"],
        design: designKeys,
        roles,
        sources,
      },
    })
  })
})

describe("the register answer says the highest format the deck stores", () => {
  const register = openRegister("", "deck")
  const node = elementId("258.7")
  const body = register.elements[rootElement]

  it("counts a stored row's format beside the index's", () => {
    if (body === undefined) throw new Error("root")
    const landed = [
      { actor: "agent" as const, visible: false, runId: "r", v: format, patch: { box: { x: { set: 1 } } } },
    ]
    const withRow = {
      ...register,
      nodes: [...register.nodes, node],
      elements: { ...register.elements, [node]: { ...body, landed } },
    }
    expect(answeredRegister(withRow).format).toBe(format)
    expect(answeredRegister(register).format).toBeUndefined()
    const index: DeckIndex = { format: 2, total: 0, slides: [], elements: [], pages: [] }
    expect(answeredRegister({ ...register, index }).format).toBe(2)
    expect(answeredRegister({ ...withRow, index }).format).toBe(format)
  })
})
