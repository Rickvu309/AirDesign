import type { Props } from "@airdesign/doom"

export type ShownSlide = {
  readonly hidden: boolean
  readonly transition: Props["transition"] | null
  readonly advance: number | null
}
