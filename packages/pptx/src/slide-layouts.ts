import { slideAddresses } from "./package-address.js"
import { layoutPart } from "./slide-placeholders.js"

export function slideLayouts(parts: ReadonlyMap<string, Uint8Array>): ReadonlyMap<string, string> {
  const layouts = new Map<string, string>()
  for (const address of slideAddresses(parts)) {
    const layout = layoutPart(parts, address.part)
    if (layout !== null) layouts.set(address.slide, layout)
  }
  return layouts
}
