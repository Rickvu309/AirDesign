import { type Color, type FieldValue, type SlideId } from "@airdesign/document"
import { type Swatch } from "@/design/color-choices"

export type DesignShown = {
  readonly slide: SlideId
  readonly number: number
  readonly background: { readonly css: string; readonly name: string; readonly value: Color | undefined }
  readonly fill: FieldValue<"fills", "p0"> | null
  readonly templateColors: readonly Swatch[]
}
