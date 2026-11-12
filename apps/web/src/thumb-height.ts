import { slideThumbWidth } from "@/editor/slide-sidebar"

export function thumbHeight(slide: { readonly width: number; readonly height: number } | null): number {
  if (slide === null || slide.width === 0) return Math.round((slideThumbWidth * 9) / 16)
  return Math.round((slideThumbWidth * slide.height) / slide.width)
}
