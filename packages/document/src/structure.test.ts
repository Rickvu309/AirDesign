import { describe, expect, it } from "vitest"
import { kinds } from "./properties.js"
import { structure, type StructuralRoute } from "./structure.js"

type StructureRow = {
  readonly actions: readonly string[]
  readonly routes: Readonly<Record<string, string>>
}

const placed = ["create", "move", "remove", "duplicate"]

const placedRoutes = {
  create: "spTree.add",
  move: "spTree.order",
  remove: "spTree.remove",
  duplicate: "spTree.clone",
}

const table = new Map<string, StructureRow>([
  ["deck", { actions: [], routes: {} }],
  ["theme", { actions: [], routes: {} }],
  ["master", { actions: [], routes: {} }],
  ["layout", { actions: [], routes: {} }],
  [
    "section",
    {
      actions: ["create", "move", "remove"],
      routes: { create: "sectionLst.add", move: "sectionLst.order", remove: "sectionLst.remove" },
    },
  ],
  [
    "slide",
    {
      actions: placed,
      routes: {
        create: "sldIdLst.add",
        move: "sldIdLst.order",
        remove: "sldIdLst.remove",
        duplicate: "sldIdLst.clone",
      },
    },
  ],
  ["shape", { actions: placed, routes: placedRoutes }],
  ["picture", { actions: placed, routes: placedRoutes }],
  ["connector", { actions: placed, routes: placedRoutes }],
  ["group", { actions: placed, routes: placedRoutes }],
  [
    "table",
    {
      actions: placed,
      routes: {
        create: "graphicFrame.addTable",
        move: "spTree.order",
        remove: "spTree.remove",
        duplicate: "spTree.clone",
      },
    },
  ],
  [
    "row",
    {
      actions: ["create", "move", "remove"],
      routes: { create: "tbl.addRow", move: "tbl.orderRow", remove: "tbl.removeRow" },
    },
  ],
  ["cell", { actions: [], routes: {} }],
  [
    "chart",
    {
      actions: placed,
      routes: {
        create: "graphicFrame.addChart",
        move: "spTree.order",
        remove: "spTree.remove",
        duplicate: "spTree.clone",
      },
    },
  ],
  ["kept", { actions: ["move", "remove"], routes: { move: "spTree.order", remove: "spTree.remove" } }],
])

function rowOf(kind: string): StructureRow {
  const row = table.get(kind)
  if (row === undefined) {
    throw new Error(`missing row ${kind}`)
  }
  return row
}

function readRoute(record: object, action: string): string {
  const entry = Object.getOwnPropertyDescriptor(record, action)?.value
  if (typeof entry !== "object" || entry === null || !("route" in entry) || typeof entry.route !== "string") {
    throw new Error(`missing route ${action}`)
  }
  return entry.route
}

function visit(kind: (typeof kinds)[number], seen: Set<string>): void {
  const row = rowOf(kind)
  const actual = structure[kind]
  expect(Object.keys(actual), kind).toEqual([...row.actions])
  for (const action of row.actions) {
    const name = `${kind}.${action}`
    const expected = row.routes[action]
    if (expected === undefined) {
      throw new Error(`missing row ${name}`)
    }
    expect(readRoute(actual, action), name).toBe(expected)
    seen.add(name)
  }
  seen.add(kind)
}

function walk(): void {
  expect(Object.keys(structure)).toEqual([...kinds])
  const keptMove: StructuralRoute = structure.kept.move.route
  expect(keptMove, "kept.move").toBe(rowOf("kept").routes.move)
  const seen = new Set<string>()
  for (const kind of kinds) {
    visit(kind, seen)
  }
  for (const kind of ["deck", "theme", "master", "layout", "cell"]) {
    if (!seen.has(kind)) {
      throw new Error(`not visited: ${kind}`)
    }
    expect(rowOf(kind).actions, kind).toEqual([])
  }
  for (const kind of table.keys()) {
    if (!seen.has(kind)) {
      throw new Error(`not visited: ${kind}`)
    }
    for (const action of rowOf(kind).actions) {
      const name = `${kind}.${action}`
      if (!seen.has(name)) {
        throw new Error(`not visited: ${name}`)
      }
    }
  }
}

describe("structure", () => {
  it("names a structural route for every action", () => {
    walk()
  })
})
