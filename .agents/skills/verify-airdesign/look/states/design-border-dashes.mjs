import { borderWords } from "../../bin/product-copy.mjs"
import border, { bordered } from "./design-border.mjs"

export default { ...border, name: "design-border-dashes", drive: (kit) => bordered(kit, borderWords["border.dash"]) }
