import { element } from "../doom-design.mjs"
import { textTypography } from "../text-typography.mjs"

export default { name: "design-text-sizes", design: element, drive: (kit) => textTypography(kit, "sizes") }
