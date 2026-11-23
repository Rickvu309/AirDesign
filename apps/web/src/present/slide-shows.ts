import { type SlideTransition } from "@airdesign/pptx"

export type ShownSlide = {
  readonly hidden: boolean
  readonly transition: SlideTransition | null
  readonly advance: number | null
}
