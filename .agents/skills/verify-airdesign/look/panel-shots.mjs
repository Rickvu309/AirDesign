import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { panelKinds, reachPanel } from "./panel-kinds.mjs"

const figma = process.env.PANEL_FIGMA
const out = process.env.PANEL_OUT
const figmaShots = { frame: "pair" }
const kinds = process.env.PANEL_KINDS ? process.env.PANEL_KINDS.split(",") : panelKinds

async function shoot(kit, kind) {
  const { page } = kit
  await page.setViewportSize({ width: 1470, height: 2400 })
  await reachPanel(kit, kind)
  const box = await page.locator("[data-design-panel]").evaluate((panel) => {
    const outer = panel.closest("[data-editor-panel]").getBoundingClientRect()
    const top = panel.getBoundingClientRect().top
    const bottom = Math.max(...[...panel.querySelectorAll("*")].map((each) => each.getBoundingClientRect().bottom))
    return { x: outer.left + 1, y: top, width: outer.width - 1, height: Math.ceil(bottom - top + 24) }
  })
  const file = path.join(out, `${kind}.png`)
  await page.screenshot({ path: file, clip: box })
  kit.note(`${kind}: ${file}`)
  return { file, height: box.height }
}

function beside(shot, kind) {
  const shown = path.join(figma, `${figmaShots[kind] ?? kind}.png`)
  const right = existsSync(shown)
    ? `<img src="file://${shown}" style="width:240px;display:block">`
    : "<p>No Figma shot</p>"
  return `<!doctype html><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f5f5f2;font:600 13px system-ui;width:max-content}
  .row{display:flex;gap:16px;align-items:flex-start}.f{background:#fff;box-shadow:0 0 0 1px #ccc;width:240px}b{display:block;margin-bottom:6px}</style>
  <div class="row"><div><b>Ours: ${kind}</b><div class="f"><img src="file://${shot.file}" style="width:240px;display:block"></div></div>
  <div><b>Figma: ${kind}</b><div class="f">${right}</div></div></div>`
}

export default async function drive(kit) {
  if (out === undefined) throw new Error("set PANEL_OUT to the folder for the captures")
  mkdirSync(out, { recursive: true })
  const browser = kit.context.browser()
  for (const kind of kinds) {
    const shot = await shoot(kit, kind)
    if (figma === undefined) continue
    const html = path.join(out, `${kind}.html`)
    writeFileSync(html, beside(shot, kind))
    const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 560, height: 900 } })
    await page.goto(`file://${html}`)
    await page.locator("body").screenshot({ path: path.join(out, `beside-${kind}.png`) })
    await page.close()
  }
}
