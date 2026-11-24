import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fixtureBytes, manifest } from "./fixture-faces.mjs"

async function measureProfiles(chromium, folder) {
  const fontDir = join(folder, "fonts")
  await mkdir(fontDir, { recursive: true })
  await writeFile(join(fontDir, manifest.JP.file), await fixtureBytes(manifest.JP))
  const geist = (await fixtureBytes(manifest.Geist)).toString("base64")

  async function measure(profile, localFaces) {
    const config = join(folder, profile + ".conf")
    await writeFile(
      config,
      `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>/usr/share/fonts/truetype/dejavu</dir>
  ${localFaces ? '<dir prefix="relative">fonts</dir>' : ""}
  <cachedir prefix="xdg">fontconfig</cachedir>
</fontconfig>`,
    )
    const browser = await chromium.launch({
      env: { ...process.env, FONTCONFIG_FILE: config, XDG_CACHE_HOME: join(folder, profile) },
    })
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<span id="sample" style="font: 44px AD-Geist, sans-serif; font-synthesis: none; text-rendering: geometricPrecision">Geist 収益 uncovered</span>`,
      )
      const width = await page.locator("#sample").evaluate(async (span, base64) => {
        const face = new FontFace("AD-Geist", Uint8Array.fromBase64(base64), { weight: "100 900" })
        document.fonts.add(await face.load())
        return span.getBoundingClientRect().width
      }, geist)
      const cdp = await page.context().newCDPSession(page)
      await cdp.send("DOM.enable")
      await cdp.send("CSS.enable")
      const { root } = await cdp.send("DOM.getDocument")
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#sample" })
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId })
      return { width, localFonts: fonts.filter(({ isCustomFont }) => !isCustomFont) }
    } finally {
      await browser.close()
    }
  }

  return { withoutLocal: await measure("without", false), withLocal: await measure("with", true) }
}

export async function measureLocalHan(chromium) {
  const folder = await mkdtemp(join(tmpdir(), "airdesign-local-han-"))
  try {
    return await measureProfiles(chromium, folder)
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}
