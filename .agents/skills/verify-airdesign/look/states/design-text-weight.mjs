import { textTypography } from "../text-typography.mjs"

export default {
  name: "design-text-weight",
  design: "/screens/s43-09-editor-tools-design-element",
  drive: (kit) => textTypography(kit, "weight"),
}
