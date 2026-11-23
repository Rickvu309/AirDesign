import type { Box, ElementId } from "@airdesign/document"

import type { WireAdd, WireSet } from "./set-wire.js"
import type { WireDiagram } from "./diagram-wire.js"
import type { WireGroup } from "./group-wire.js"
import type { WireDelete, WireSlideChange } from "./slide-change-wire.js"

type Edited = (
  | { readonly value: string; readonly property?: never }
  | { readonly property: "box"; readonly value: Box }
) & {
  readonly node: ElementId
  readonly floor?: string
}

type Unnamed = {
  readonly actor?: never
  readonly command?: never
  readonly principal?: never
  readonly person?: never
  readonly agent?: never
  readonly surface?: never
  readonly onBehalfOf?: never
}

export type WireChange = Edited & Unnamed & { readonly readAt: number }

export type AgentChange = WireChange | WireSet | WireAdd | WireGroup | WireDiagram | WireSlideChange | WireDelete
