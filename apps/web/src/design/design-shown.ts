import type * as doom from "@airdesign/doom"
import { type Swatch } from "@/design/color-choices"
import type { PanelPaint } from "@/design/panel"

export type DesignShown = {
  readonly number: number
  readonly background: { readonly css: string; readonly name: string; readonly value: doom.Color | undefined }
  readonly fill: PanelPaint | null
  readonly templateColors: readonly Swatch[]
}
