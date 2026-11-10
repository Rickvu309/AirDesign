import { type Kind } from "./properties.js"

function route<const Name extends string>(name: Name): { readonly route: Name } {
  return { route: name }
}

const sectionLstAdd = route("sectionLst.add")
const sectionLstOrder = route("sectionLst.order")
const sectionLstRemove = route("sectionLst.remove")
const sldIdLstAdd = route("sldIdLst.add")
const sldIdLstOrder = route("sldIdLst.order")
const sldIdLstRemove = route("sldIdLst.remove")
const sldIdLstClone = route("sldIdLst.clone")
const spTreeAdd = route("spTree.add")
const spTreeOrder = route("spTree.order")
const spTreeRemove = route("spTree.remove")
const spTreeClone = route("spTree.clone")
const graphicFrameAddTable = route("graphicFrame.addTable")
const tblAddRow = route("tbl.addRow")
const tblOrderRow = route("tbl.orderRow")
const tblRemoveRow = route("tbl.removeRow")
const graphicFrameAddChart = route("graphicFrame.addChart")

const placed = {
  create: spTreeAdd,
  move: spTreeOrder,
  remove: spTreeRemove,
  duplicate: spTreeClone,
} as const

export type StructuralAction = "create" | "move" | "remove" | "duplicate"

type NamedRoute<Name extends string> = {
  readonly route: Name
}

type NoActions = {
  readonly [Action in StructuralAction]?: never
}

type Placed = {
  readonly create: NamedRoute<"spTree.add">
  readonly move: NamedRoute<"spTree.order">
  readonly remove: NamedRoute<"spTree.remove">
  readonly duplicate: NamedRoute<"spTree.clone">
}

type StructuralRoutes = {
  readonly deck: NoActions
  readonly theme: NoActions
  readonly master: NoActions
  readonly layout: NoActions
  readonly section: {
    readonly create: NamedRoute<"sectionLst.add">
    readonly move: NamedRoute<"sectionLst.order">
    readonly remove: NamedRoute<"sectionLst.remove">
  }
  readonly slide: {
    readonly create: NamedRoute<"sldIdLst.add">
    readonly move: NamedRoute<"sldIdLst.order">
    readonly remove: NamedRoute<"sldIdLst.remove">
    readonly duplicate: NamedRoute<"sldIdLst.clone">
  }
  readonly shape: Placed
  readonly picture: Placed
  readonly connector: Placed
  readonly group: Placed
  readonly table: {
    readonly create: NamedRoute<"graphicFrame.addTable">
    readonly move: NamedRoute<"spTree.order">
    readonly remove: NamedRoute<"spTree.remove">
    readonly duplicate: NamedRoute<"spTree.clone">
  }
  readonly row: {
    readonly create: NamedRoute<"tbl.addRow">
    readonly move: NamedRoute<"tbl.orderRow">
    readonly remove: NamedRoute<"tbl.removeRow">
  }
  readonly cell: NoActions
  readonly chart: {
    readonly create: NamedRoute<"graphicFrame.addChart">
    readonly move: NamedRoute<"spTree.order">
    readonly remove: NamedRoute<"spTree.remove">
    readonly duplicate: NamedRoute<"spTree.clone">
  }
  readonly kept: {
    readonly move: NamedRoute<"spTree.order">
    readonly remove: NamedRoute<"spTree.remove">
  }
}

type Covered = keyof StructuralRoutes extends Kind
  ? Kind extends keyof StructuralRoutes
    ? StructuralRoutes
    : never
  : never

export const structure = {
  deck: {},
  theme: {},
  master: {},
  layout: {},
  section: { create: sectionLstAdd, move: sectionLstOrder, remove: sectionLstRemove },
  slide: {
    create: sldIdLstAdd,
    move: sldIdLstOrder,
    remove: sldIdLstRemove,
    duplicate: sldIdLstClone,
  },
  shape: placed,
  picture: placed,
  connector: placed,
  group: placed,
  table: {
    create: graphicFrameAddTable,
    move: spTreeOrder,
    remove: spTreeRemove,
    duplicate: spTreeClone,
  },
  row: { create: tblAddRow, move: tblOrderRow, remove: tblRemoveRow },
  cell: {},
  chart: {
    create: graphicFrameAddChart,
    move: spTreeOrder,
    remove: spTreeRemove,
    duplicate: spTreeClone,
  },
  kept: { move: spTreeOrder, remove: spTreeRemove },
} as const satisfies Covered

type StructureTable = typeof structure

export type StructuralRoute = {
  [KindName in keyof StructureTable]: StructureTable[KindName][keyof StructureTable[KindName]] extends {
    readonly route: infer Name
  }
    ? Name
    : never
}[keyof StructureTable]
