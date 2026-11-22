import { type Kind } from "./kinds.js"

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
  readonly notes: NoActions
  readonly shape: Placed
  readonly connector: Placed
  readonly group: Placed
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
  master: {},
  layout: {},
  section: { create: sectionLstAdd, move: sectionLstOrder, remove: sectionLstRemove },
  slide: {
    create: sldIdLstAdd,
    move: sldIdLstOrder,
    remove: sldIdLstRemove,
    duplicate: sldIdLstClone,
  },
  notes: {},
  shape: placed,
  connector: placed,
  group: placed,
  kept: { move: spTreeOrder, remove: spTreeRemove },
} as const satisfies Covered
