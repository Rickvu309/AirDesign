import { productCopy } from "../../bin/product-copy.mjs"
import { cutOff, noticeAfterEdit } from "../save-notices.mjs"

export default {
  name: "editor-offline",
  design: "/screens/s49-02-editor-errors-offline",
  drive: (kit) => noticeAfterEdit(kit, cutOff, productCopy.editorOffline),
}
