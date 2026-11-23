import { productCopy } from "../../bin/product-copy.mjs"
import { noticeAfterEdit } from "../save-notices.mjs"

async function deviceFull(kit) {
  await kit.page.route(`**${kit.doomRoutes.edit.path}`, () => undefined)
  await kit.page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("full", "QuotaExceededError")
    }
  })
}

export default {
  name: "editor-storage-failed",
  design: "/screens/s49-04-editor-errors-unreached",
  drive: (kit) => noticeAfterEdit(kit, deviceFull, productCopy.storageFailed),
}
