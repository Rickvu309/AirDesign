import { properties, structure } from "@airdesign/document"
import { describe, expect, it } from "vitest"
import { writtenRoutes } from "./written-routes.js"

describe("writtenRoutes", () => {
  it("writes each edit through the route document names for a shape", () => {
    expect(writtenRoutes).toEqual({
      fill: properties.shape.fill.route,
      text: properties.shape.text.route,
      move: properties.shape.box.route,
      resize: properties.shape.box.route,
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
      addTable: structure.table.create.route,
      addRow: structure.row.create.route,
      removeRow: structure.row.remove.route,
      orderRow: structure.row.move.route,
      columns: properties.table.columns.route,
    })
  })
})
