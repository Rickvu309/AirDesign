import { expect, it } from "vitest"
import { readSlideChange, slideChangeSchema } from "./slide-change-wire.js"

it("accepts same or new slide group placement only for add_slide and preserves its default", () => {
  for (const group of ["same", "new"]) {
    expect(readSlideChange({ op: "add_slide", after: "256", layout: "257", group })).toEqual({
      ok: true,
      change: { op: "add_slide", after: "256", layout: "257", group },
    })
  }
  expect(readSlideChange({ op: "add_slide", after: "256", layout: "257" })).toEqual({
    ok: true,
    change: { op: "add_slide", after: "256", layout: "257" },
  })
  for (const raw of [
    { op: "add_slide", after: "256", layout: "257", group: "keep" },
    { op: "move_slide", slide: "257", after: "256", group: "new" },
    { op: "duplicate_slide", slide: "257", group: "new" },
  ])
    expect(readSlideChange(raw)).toMatchObject({ ok: false, field: "group" })
  expect(slideChangeSchema().properties).toHaveProperty(
    "group",
    expect.objectContaining({ enum: ["same", "new", "keep"] }),
  )
  expect(slideChangeSchema().properties).not.toHaveProperty("row")
})

it("still reads the old name row for the slide group of add_slide and move_slides", () => {
  expect(readSlideChange({ op: "add_slide", after: "256", layout: "257", row: "new" })).toEqual({
    ok: true,
    change: { op: "add_slide", after: "256", layout: "257", group: "new" },
  })
  expect(readSlideChange({ op: "move_slides", slides: ["258"], after: "257", row: "keep" })).toEqual({
    ok: true,
    change: { op: "move_slides", slides: ["258"], after: "257", group: "keep" },
  })
  expect(readSlideChange({ op: "add_slide", after: "256", layout: "257", row: "keep" })).toMatchObject({
    ok: false,
    field: "group",
  })
  expect(readSlideChange({ op: "move_slide", slide: "257", after: "256", row: "new" })).toMatchObject({
    ok: false,
    field: "row",
  })
})

it("refuses a call that sends both group and row", () => {
  expect(readSlideChange({ op: "add_slide", after: "256", layout: "257", group: "new", row: "new" })).toMatchObject({
    ok: false,
    field: "group",
  })
  expect(
    readSlideChange({ op: "move_slides", slides: ["258"], after: "257", group: "same", row: "same" }),
  ).toMatchObject({ ok: false, field: "group" })
})

it("reads an atomic group move and refuses malformed or empty groups", () => {
  const command = { op: "move_slides", slides: ["258", "256"], after: "257", group: "new" }
  expect(readSlideChange(command)).toEqual({ ok: true, change: command })
  for (const slides of [[], ["256", "256"], ["bad"]])
    expect(readSlideChange({ ...command, slides })).toMatchObject({ ok: false, field: "slides" })
})

it("reads plural slide lifecycle changes without placement or duplicate ids", () => {
  for (const op of ["duplicate_slides", "delete_slides"]) {
    const change = { op, slides: ["258", "256"] }
    expect(readSlideChange(change)).toEqual({ ok: true, change })
    expect(readSlideChange({ ...change, slides: ["256", "256"] })).toMatchObject({ ok: false, field: "slides" })
    expect(readSlideChange({ ...change, after: "257" })).toMatchObject({ ok: false, field: "after" })
  }
})

it("reads add_slide with neither after nor layout, for the engine to place after the last slide", () => {
  expect(readSlideChange({ op: "add_slide" })).toEqual({ ok: true, change: { op: "add_slide" } })
  expect(readSlideChange({ op: "add_slide", after: "256" })).toEqual({
    ok: true,
    change: { op: "add_slide", after: "256" },
  })
  expect(readSlideChange({ op: "add_slide", layout: "bad id" })).toEqual({
    ok: false,
    refusal: "field",
    field: "layout",
  })
})

it("reads add_slide's layout as a slide id or a layout id from the read", () => {
  expect(readSlideChange({ op: "add_slide", layout: "L3" })).toEqual({
    ok: true,
    change: { op: "add_slide", layoutAt: 2 },
  })
  expect(readSlideChange({ op: "add_slide", layout: "257" })).toEqual({
    ok: true,
    change: { op: "add_slide", layout: "257" },
  })
  for (const layout of ["L0", "L100", "l3", "L", 3, "Title"])
    expect(readSlideChange({ op: "add_slide", layout })).toEqual({ ok: false, refusal: "field", field: "layout" })
})
