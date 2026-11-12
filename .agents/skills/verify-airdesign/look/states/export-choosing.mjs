import { exportDialog, powerpoint } from "../export-dialog.mjs"

async function drive(kit) {
  await exportDialog(kit)
}

export default { name: "export-choosing", design: powerpoint, drive }
