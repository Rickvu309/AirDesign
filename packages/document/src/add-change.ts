import type { Box } from "./box.js"
import type { TraitInput } from "./change.js"
import type { SlideId } from "./element-id.js"

export type AddChange =
  | { readonly kind: "shape"; readonly slide: SlideId; readonly box?: Box; readonly text?: TraitInput<"text"> }
  | { readonly kind: "shape"; readonly slide: SlideId; readonly box?: Box; readonly icon: string }
  | { readonly kind: "shape"; readonly slide: SlideId; readonly box?: Box; readonly image: string }
  | {
      readonly kind: "line" | "arrow" | "elbow"
      readonly slide: SlideId
      readonly box?: Box
      readonly connection?: TraitInput<"connection">
    }
  | { readonly kind: "table"; readonly slide: SlideId; readonly box?: Box; readonly table: { readonly value: string } }
  | { readonly kind: "chart"; readonly slide: SlideId; readonly box?: Box; readonly chart: { readonly value: string } }
