import { productCopy } from "../../bin/product-copy.mjs"
import { editAnswers, noticeAfterEdit } from "../save-notices.mjs"

export default {
  name: "edit-set-aside-too-large",
  design: "/screens/s49-05-editor-errors-edit-set-aside-too-large",
  drive: (kit) =>
    noticeAfterEdit(kit, (each) => editAnswers(each, { ok: false, refusal: "size" }), productCopy.editSetAsideTooLarge),
}
