import type { ServedFace } from "@airdesign/fonts"
import { fontsFor } from "@airdesign/render"
import { useSyncExternalStore } from "react"

const loader = () => (typeof document === "undefined" ? undefined : fontsFor(document))
const subscribeTo = (listener: () => void) => loader()?.subscribe(listener) ?? (() => undefined)
const settledNow = () => loader()?.settledCount() ?? 0
const unsettled = () => 0

export function servedFaces(family: string): readonly ServedFace[] | undefined {
  const fonts = loader()
  if (fonts === undefined) return undefined
  if (!fonts.ready(family)) queueMicrotask(() => void fonts.load(family))
  return fonts.faces(family)
}

export function useServedFaces(): void {
  useSyncExternalStore(subscribeTo, settledNow, unsettled)
}
