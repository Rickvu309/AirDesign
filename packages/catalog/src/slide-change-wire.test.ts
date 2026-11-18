import { expect, it } from "vitest"
import { readSlideChange, slideChangeSchema } from "./slide-change-wire.js"

it("accepts same or new row placement only for add_slide and preserves its default", () => {
  for (const row of ["same", "new"]) {
    expect(readSlideChange({ op: "add_slide", after: "256", layout: "257", row })).toEqual({
      ok: true,
      change: { op: "add_slide", after: "256", layout: "257", row },
    })
  }
  expect(readSlideChange({ op: "add_slide", after: "256", layout: "257" })).toEqual({
    ok: true,
    change: { op: "add_slide", after: "256", layout: "257" },
  })
  for (const raw of [
    { op: "add_slide", after: "256", layout: "257", row: "keep" },
    { op: "move_slide", slide: "257", after: "256", row: "new" },
    { op: "duplicate_slide", slide: "257", row: "new" },
  ])
    expect(readSlideChange(raw)).toMatchObject({ ok: false, field: "row" })
  expect(slideChangeSchema().properties).toHaveProperty(
    "row",
    expect.objectContaining({ enum: ["same", "new", "keep"] }),
  )
})

it("reads an atomic group move and refuses malformed or empty groups", () => {
  const command = { op: "move_slides", slides: ["258", "256"], after: "257", row: "new" }
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
