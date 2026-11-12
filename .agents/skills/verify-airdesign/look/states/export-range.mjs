import { chooseRange, powerpoint } from "../export-dialog.mjs"

async function drive(kit) {
  await chooseRange(kit, "doe-heat-pumps.pptx", "3", "7")
}

export default { name: "export-range", design: powerpoint, drive }
