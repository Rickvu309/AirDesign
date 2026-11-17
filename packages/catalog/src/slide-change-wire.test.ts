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
  expect(slideChangeSchema().properties).toHaveProperty("row", expect.objectContaining({ enum: ["same", "new"] }))
})
