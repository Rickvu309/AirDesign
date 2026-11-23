import { type ElementId } from "@airdesign/document"

export type LayerJoin = {
  readonly change: "join"
  readonly node: ElementId
  readonly parent: ElementId | null
  readonly before: ElementId | null
  readonly from: ElementId | null
}
