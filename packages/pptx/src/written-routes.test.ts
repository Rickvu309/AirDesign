import { structure } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { writtenRoutes } from "./written-routes.js"

describe("writtenRoutes", () => {
  it("writes each structural edit through the route document names for it", () => {
    const fieldEdits = ["fill", "text", "move", "resize", "columns"]
    const structural = Object.fromEntries(Object.entries(writtenRoutes).filter(([edit]) => !fieldEdits.includes(edit)))
    expect(structural).toEqual({
      add: structure.shape.create.route,
      remove: structure.shape.remove.route,
      order: structure.shape.move.route,
      clone: structure.shape.duplicate.route,
      addSlide: structure.slide.create.route,
      removeSlide: structure.slide.remove.route,
      orderSlide: structure.slide.move.route,
      cloneSlide: structure.slide.duplicate.route,
      addSection: structure.section.create.route,
      removeSection: structure.section.remove.route,
      orderSection: structure.section.move.route,
    })
  })
})
