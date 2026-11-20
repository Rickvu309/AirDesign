import fc from "fast-check"
import { expect, it } from "vitest"
import {
  appendIndex,
  decide,
  elementId,
  format,
  gridCommandVersion,
  gridGroups,
  openRegister,
  readSlideState,
  slideId,
  type Register,
  type SlideCommand,
} from "./index.js"

const file = Array.from({ length: 6 }, (_, index) => slideId(String(256 + index)))
const sectionStarts = [file[0]!, file[3]!]
const page = {
  once: "opening",
  offset: 0,
  total: 0,
  slides: file.map((id, position) => ({ id, position })),
  elements: [],
}

it("uses section starts only after a complete index upgrade", () => {
  const old = appendIndex(undefined, page)
  if (!old.ok) throw new Error(old.refusal)
  const upgraded = appendIndex(old.index, { ...page, format, sectionStarts })
  if (!upgraded.ok) throw new Error(upgraded.refusal)
  expect(gridGroups({ file, order: [], index: old.index })).toEqual([file.slice(0, 4), file.slice(4)])
  expect(gridGroups({ file, order: [], index: upgraded.index })).toEqual([file.slice(0, 3), file.slice(3)])
})

const recorded = {
  file: ["256", "257", "258", "259", "260", "261"],
  order: [{ id: "257", grid: 1, slide: "remove" }],
}

it("replays the recorded version one log unchanged when section starts arrive", () => {
  const original = readSlideState(recorded)
  if (original === undefined) throw new Error("grid command")
  const index = appendIndex(undefined, { ...page, format, sectionStarts })
  if (!index.ok) throw new Error(index.refusal)
  const frozen = [
    ["256", "258", "259"],
    ["260", "261"],
  ]
  expect(gridGroups(original)).toEqual(frozen)
  expect(gridGroups({ ...original, index: index.index })).toEqual(frozen)
})

it("replays a recorded version two edit against the packed opening partition", () => {
  const recorded = {
    file: ["256", "257", "258", "259", "260", "261"],
    sectionStarts: ["256", "257", "258", "259"],
    order: [{ id: "257", grid: 2, slide: "remove" }],
  }
  const state = readSlideState(recorded)
  if (state === undefined) throw new Error("grid command")
  const index = appendIndex(undefined, { ...page, format, sectionStarts: recorded.sectionStarts.map(slideId) })
  if (!index.ok) throw new Error(index.refusal)
  expect(gridGroups({ ...state, index: index.index })).toEqual([
    ["256", "258"],
    ["259", "260", "261"],
  ])
})

it("freezes the first tagged default through both orders of a mixed-version log", () => {
  const index = appendIndex(undefined, { ...page, format, sectionStarts })
  if (!index.ok) throw new Error(index.refusal)
  const [first] = recorded.order
  for (const [opening, later, frozen] of [
    [
      1,
      2,
      [
        ["256", "262", "258", "259"],
        ["260", "261"],
      ],
    ],
    [
      2,
      1,
      [
        ["256", "262", "258"],
        ["259", "260", "261"],
      ],
    ],
  ] as const) {
    const order = [
      { ...first, grid: opening },
      { slide: "clone", grid: later, source: "256", id: "262" },
    ]
    const state = readSlideState({ ...recorded, order })
    if (state === undefined) throw new Error("grid command")
    expect(gridGroups({ ...state, index: index.index })).toEqual(frozen)
  }
})

it("plans a newer Grid command once the section starts are known", () => {
  const older = { slide: "remove", grid: 2, id: file[1]! } as const
  expect(gridCommandVersion({ order: [] })).toBe(1)
  expect(gridCommandVersion({ order: [older] })).toBe(older.grid)
  const sectioned = gridCommandVersion({ order: [], sectionStarts })
  expect(sectioned).toBeGreaterThan(older.grid)
  expect(gridCommandVersion({ order: [], sectionStarts: [] })).toBe(sectioned)
  expect(gridCommandVersion({ order: [older], sectionStarts })).toBe(sectioned)
})

it("refuses to freeze a version two grid while the section starts are unavailable", () => {
  const edit = { slide: "remove", grid: 2, id: file[1]! } as const
  expect(decide(openRegister("", ""), { command: "slide", file, edit })).toMatchObject({ decision: "refuse" })
})

it("preserves section placement from the legacy prefix and drops an emptied section", () => {
  const index = appendIndex(undefined, { ...page, format, sectionStarts: [file[0]!, file[1]!, file[4]!] })
  if (!index.ok) throw new Error(index.refusal)
  const legacy = readSlideState({
    file,
    order: [
      { slide: "remove", id: file[0] },
      { slide: "remove", id: file[1] },
    ],
  })
  if (legacy === undefined) throw new Error("legacy")
  const before = { ...openRegister("", ""), ...legacy, index: index.index }
  expect(gridGroups(before)).toEqual([file.slice(2)])
  const after = decide(before, { command: "slide", file, edit: { slide: "remove", grid: 2, id: file[2]! } })
  if (after.decision !== "apply") throw new Error(after.code)
  expect(gridGroups(after.register)).toEqual([file.slice(3)])
})

it("upgrades beside the old index and freezes the published starts across later index writes", () => {
  const elements = file.slice(0, 2).map((id) => ({
    node: elementId(`${id}.2`),
    kind: "shape" as const,
    value: null,
    box: null,
    grouped: false,
  }))
  const old = appendIndex(undefined, { ...page, total: 2, elements })
  if (!old.ok) throw new Error(old.refusal)
  const first = { ...page, total: 2, format, sectionStarts, elements: elements.slice(0, 1) }
  const half = appendIndex(old.index, first)
  if (!half.ok) throw new Error(half.refusal)
  expect(gridGroups({ file, order: [], index: half.index })).toEqual([file.slice(0, 4), file.slice(4)])
  const last = { ...first, once: "second", offset: 1, elements: elements.slice(1) }
  expect(appendIndex(half.index, { ...last, sectionStarts: [file[0]!] })).toEqual({ ok: false, refusal: "present" })
  const done = appendIndex(half.index, last)
  if (!done.ok) throw new Error(done.refusal)
  expect(gridGroups({ file, order: [], index: done.index })).toEqual([file.slice(0, 3), file.slice(3)])
  expect(appendIndex(done.index, { ...last, sectionStarts: [] })).toEqual({ ok: false, refusal: "present" })
})

function sectionedGrid(sizes: readonly number[]) {
  const file = Array.from({ length: sizes.reduce((sum, size) => sum + size, 0) }, (_, i) => slideId(String(256 + i)))
  let offset = 0
  const sections = sizes.map((size) => {
    const run = file.slice(offset, offset + size)
    offset += size
    return run
  })
  const opening = { ...page, format, slides: file.map((id, position) => ({ id, position })) }
  const indexed = appendIndex(undefined, { ...opening, sectionStarts: sections.map((run) => run[0]!) })
  const unsectioned = appendIndex(undefined, { ...opening, sectionStarts: [] })
  if (!indexed.ok || !unsectioned.ok) throw new Error("index")
  const rows = gridGroups({ file, order: [], index: indexed.index })
  return { file, sections, rows, unsectioned: unsectioned.index }
}

it.each([
  [
    [3, 3],
    [3, 3],
  ],
  [Array<number>(12).fill(2), [6, 6, 6, 6]],
  [
    [1, 28, 10, 2],
    [1, 10, 10, 8, 10, 2],
  ],
  [
    [1, 1, 5, 6, 1, 2],
    [7, 9],
  ],
  [
    [1, 14, 2, 4],
    [1, 7, 7, 6],
  ],
  [
    [1, 25, 1],
    [1, 9, 9, 7, 1],
  ],
])("freezes the version two rows for sections of sizes %j", (sizes, lengths) => {
  expect(sectionedGrid(sizes).rows.map((row) => row.length)).toEqual(lengths)
})

it("packs only whole sections together and leaves unsectioned grids identical to version one", () => {
  fc.assert(
    fc.property(fc.array(fc.integer({ min: 1, max: 25 }), { minLength: 1, maxLength: 8 }), (sizes) => {
      fc.pre(sizes.reduce((sum, size) => sum + size, 0) <= 50)
      const { file, sections, rows, unsectioned } = sectionedGrid(sizes)
      expect(rows.flat()).toEqual(file)
      for (const row of rows) {
        const included = sections.filter((section) => section.some((id) => row.includes(id)))
        if (included.length > 1) expect(row).toEqual(included.flat())
      }
      expect(gridGroups({ file, order: [], index: unsectioned })).toEqual(gridGroups({ file, order: [] }))
    }),
  )
})

it("lets two tabs initialize from one section partition and resolves the second edit against the accepted slide groups", () => {
  const opening = appendIndex(undefined, { ...page, format, sectionStarts })
  if (!opening.ok) throw new Error(opening.refusal)
  const before = { ...openRegister("", ""), file, index: opening.index }
  const first = { slide: "add", grid: 2, row: "same", id: slideId("300"), after: file[2]!, layout: file[0]! } as const
  const second = { ...first, row: "new", id: slideId("301"), after: file[0]! } as const
  const land = (register: Register, edit: SlideCommand) => {
    const result = decide(register, { command: "slide", file, edit })
    if (result.decision !== "apply") throw new Error(result.code)
    return result.register
  }
  expect(gridGroups(land(before, second))).toEqual([file.slice(0, 3), [second.id], file.slice(3)])
  expect(gridGroups(land(land(before, first), second))).toEqual([
    [...file.slice(0, 3), first.id],
    [second.id],
    file.slice(3),
  ])
})
