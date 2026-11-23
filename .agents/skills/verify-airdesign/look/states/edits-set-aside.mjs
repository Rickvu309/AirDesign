import { productCopy } from "../../bin/product-copy.mjs"
import { editAnswers, noticeAfterEdit } from "../save-notices.mjs"

const stale = { ok: false, refusal: "edit", refused: "stale", node: "s:4", prop: "box" }

export default {
  name: "edits-set-aside",
  design: "/screens/s49-03-editor-errors-edits-set-aside",
  drive: (kit) => noticeAfterEdit(kit, (each) => editAnswers(each, stale), productCopy.editsSetAside, 2),
}
