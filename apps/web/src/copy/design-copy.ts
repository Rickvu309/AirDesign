import type { PaintFill } from "@airdesign/pptx"

type Named = Exclude<PaintFill["type"], "solid" | "none">

export const designCopy = {
  slide: (number: number) => `Slide ${String(number)}`,
  template: "Template",
  templateOff: "Templates are not available yet",
  background: "Background",
  color: "Color",
  picture: "Picture",
  pictureOff: "Picture, not available yet",
  colors: "Colors",
  white: "White",
  fills: { gradient: "Gradient", pattern: "Pattern", picture: "Picture" },
} as const satisfies {
  readonly fills: Record<Named, string>
  readonly [key: string]: unknown
}
