export { resolveFont, fontRevision, type FontFamily } from "./source.js"
export { fontFaces, type FontFile } from "./metadata.js"
export { fallbackFont, fontFamily, fontRoutes, servedFontAlias, servedFontName } from "./family.js"

export {
  boldWeight,
  holdsWeight,
  namedFace,
  readStyleName,
  regularWeight,
  styleName,
  stylesHeld,
  type ServedFace,
} from "./named-face.js"

export type { FontLayout } from "./layout-contract.js"

export const loadFontLayoutContract = (): Promise<typeof import("./layout-contract.js")> =>
  import("./layout-contract.js")

export type { FontLayoutEngine, LayoutFace } from "./layout-contract.js"

export const loadFontLayout = async (byteBudget?: number): Promise<import("./layout-contract.js").FontLayoutEngine> =>
  (await import("./layout.js")).createFontLayout(byteBudget)

export { pickServedFace, weightRange } from "./served-face.js"
export { createLayoutProbe, type LayoutComparison } from "./layout-probe.js"
