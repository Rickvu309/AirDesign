import type { Box } from "./box.js"
import type { TraitInput } from "./change.js"
import type { SlideId } from "./element-id.js"

export type AddStyle = {
  readonly fills?: TraitInput<"fills">
  readonly geometry?: TraitInput<"geometry">
  readonly border?: TraitInput<"border">
  readonly body?: TraitInput<"body">
}

export type AddChange =
  | ({
      readonly kind: "shape"
      readonly slide: SlideId
      readonly box?: Box
      readonly text?: TraitInput<"text">
    } & AddStyle)
  | { readonly kind: "shape"; readonly slide: SlideId; readonly box?: Box; readonly icon: string }
  | { readonly kind: "shape"; readonly slide: SlideId; readonly box?: Box; readonly image: string }
  | {
      readonly kind: "line" | "arrow" | "elbow"
      readonly slide: SlideId
      readonly box?: Box
      readonly connection?: TraitInput<"connection">
      readonly border?: TraitInput<"border">
    }
  | { readonly kind: "table"; readonly slide: SlideId; readonly box?: Box; readonly table: { readonly value: string } }
  | { readonly kind: "chart"; readonly slide: SlideId; readonly box?: Box; readonly chart: { readonly value: string } }
