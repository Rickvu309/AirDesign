import { element } from "../doom-design.mjs"
import { textTypography } from "../text-typography.mjs"

export default { name: "design-text-style", design: element, drive: (kit) => textTypography(kit, "style") }
