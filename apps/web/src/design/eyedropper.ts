import type { Color } from "@airdesign/document"
import { typedColor } from "@/design/color-choices"

export type Dropper = { open(options?: { readonly signal?: AbortSignal }): Promise<{ readonly sRGBHex: string }> }

export function dropperOf(): (new () => Dropper) | undefined {
  if (typeof window === "undefined") return undefined
  return (window as { EyeDropper?: new () => Dropper }).EyeDropper
}

export async function pickScreenColor(signal?: AbortSignal): Promise<Color | null> {
  const Eyedropper = dropperOf()
  if (Eyedropper === undefined) return null
  try {
    const result = await new Eyedropper().open(signal === undefined ? undefined : { signal })
    const color = typedColor(result.sRGBHex)
    return color !== null && "rgb" in color ? color : null
  } catch {
    return null
  }
}
