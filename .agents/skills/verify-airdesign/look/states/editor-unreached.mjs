import { productCopy } from "../../bin/product-copy.mjs"
import { editAnswers, noticeAfterEdit } from "../save-notices.mjs"

export default {
  name: "editor-unreached",
  design: "/screens/s49-04-editor-errors-unreached",
  drive: (kit) => noticeAfterEdit(kit, (each) => editAnswers(each), productCopy.editorUnreached),
}
