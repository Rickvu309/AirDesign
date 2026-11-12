import { choose, exportDialog, pdf } from "../export-dialog.mjs"

async function drive(kit) {
  const dialog = await exportDialog(kit)
  await choose(kit, dialog, "File type", "PDF")
}

export default { name: "export-choosing-pdf", design: pdf, drive }
