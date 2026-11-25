export { resolveFont, fontRevision, type FontFamily } from "./source.js"
export { fontFaces, type FontFile } from "./metadata.js"
export { fallbackFont, fontFamily, fontRoutes, servedFontAlias, servedFontName } from "./family.js"

export {
  boldWeight,
  holdsWeight,
  namedFace,
  pinnedOpticalSize,
  readStyleName,
  regularWeight,
  styleName,
  stylesHeld,
  type ServedFace,
} from "./named-face.js"

export type { FontLayout } from "./layout-contract.js"

export type { FontLayoutEngine, LayoutFace } from "./layout-contract.js"

export { pickServedFace, weightRange } from "./served-face.js"
export { createLayoutProbe, type LayoutComparison } from "./layout-probe.js"
