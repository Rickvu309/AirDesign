import { textTypography } from "../text-typography.mjs"

export default {
  name: "design-text-style",
  design: "/screens/s43-09-editor-tools-design-element",
  drive: (kit) => textTypography(kit, "style"),
}
