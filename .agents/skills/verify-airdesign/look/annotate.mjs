import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { PNG } from "pngjs"
import { arrow, circleRadius, frameMargin, place, scaled } from "./placement.mjs"

export const pageWidth = 850
export const imageScale = 2
export const heightCap = 6000
const padding = 18
const between = 14

const escape = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")

export function themeCss(repo) {
  const tokens = readFileSync(path.join(repo, "packages/theme/src/tokens.css"), "utf8").match(/:root\s*\{[^}]*\}/)
  const font = path.join(repo, "apps/web/node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2")
  const face = existsSync(font)
    ? `@font-face{font-family:"Geist Variable";font-weight:100 900;src:url(data:font/woff2;base64,${readFileSync(font).toString("base64")}) format("woff2")}`
    : ""
  return `${face}${tokens?.[0] ?? ""}`
}

const style = `*{box-sizing:border-box}html,body{margin:0;background:var(--canvas)}
body{width:${String(pageWidth)}px;font-family:"Geist Variable",system-ui,sans-serif;color:var(--foreground);-webkit-font-smoothing:antialiased}
main{display:flex;flex-direction:column;gap:${String(between)}px;padding:${String(between)}px}
article{background:var(--background);border:1px solid var(--line);border-radius:10px;padding:${String(padding)}px}
h2{margin:0 0 10px;font-size:15px;line-height:20px;font-weight:600;display:flex;gap:8px;align-items:center}
.badge{font-size:11px;font-weight:600;color:var(--background);background:var(--callout);border-radius:999px;padding:1px 8px}
.badge.failed{color:var(--muted-foreground);background:none;border:1px dashed var(--muted-foreground)}
.pair{display:flex;flex-direction:column;gap:10px}.pair.beside{flex-direction:row;justify-content:space-between}
.label{font-size:11px;line-height:14px;font-weight:600;letter-spacing:.04em;color:var(--muted-foreground);margin-bottom:2px}
.frame{position:relative}.frame img{position:absolute;border:1px solid var(--line);border-radius:4px;display:block}
.frame svg{position:absolute;left:0;top:0;overflow:visible}
.reason{font-size:12px;color:var(--muted-foreground);margin:4px 0 0}
ol{list-style:none;margin:12px 0 0;padding:12px 0 0;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr 1fr;gap:6px 20px}
li{display:flex;gap:8px;align-items:flex-start;font-size:13px;line-height:18px}
.number{flex:none;width:18px;height:18px;border-radius:50%;background:var(--callout);color:var(--background);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}
.missing{color:var(--muted-foreground)}`

function layout(width, height) {
  const inner = pageWidth - between * 2 - padding * 2 - 2
  const stacked = Math.min(1, (inner - frameMargin * 2) / width)
  const beside = Math.min(1, ((inner - 10) / 2 - frameMargin * 2) / width)
  const sideBySide = beside >= stacked * 0.75 && height * beside < 980
  const scale = sideBySide ? beside : stacked
  return { sideBySide, scale, width: width * scale, height: height * scale }
}

export function marks(block) {
  const shape = layout(block.width, block.height)
  const per = block.sides.map((side) => side.boxes.map((box) => scaled(box, shape.scale)))
  const targets = block.callouts.map(
    (_, index) => per.map((boxes) => boxes[index]).findLast((box) => box !== null) ?? null,
  )
  const obstacles = block.sides.flatMap((side) => (side.texts ?? []).map((box) => scaled(box, shape.scale)))
  const circles = place(targets, { width: shape.width, height: shape.height }, { obstacles })
  return {
    shape,
    circles,
    sides: per.map((boxes) =>
      circles.map((circle, index) =>
        circle === null || boxes[index] === null ? null : arrow(circle, boxes[index], circleRadius),
      ),
    ),
  }
}

function sideHtml(side, shape, circles, arrows) {
  const outer = { width: shape.width + frameMargin * 2, height: shape.height + frameMargin * 2 }
  const shift = (point) => `${(point.x + frameMargin).toFixed(1)},${(point.y + frameMargin).toFixed(1)}`
  const lines = arrows
    .map((line) =>
      line === null
        ? ""
        : `<polyline points="${shift(line.from)} ${shift(line.to)}" stroke="var(--background)" stroke-width="6" stroke-linecap="round" fill="none" opacity=".9"/><polyline points="${shift(line.from)} ${shift(line.to)}" stroke="var(--callout)" stroke-width="2.5" stroke-linecap="round" fill="none" marker-end="url(#tip)"/>`,
    )
    .join("")
  const dots = circles
    .map((circle, index) => {
      if (circle === null) return ""
      const fill = arrows[index] === null ? "var(--muted-foreground)" : "var(--callout)"
      const [x, y] = shift(circle).split(",")
      return `<g data-callout="${String(index + 1)}" data-cx="${x}" data-cy="${y}"><circle cx="${x}" cy="${y}" r="${String(circleRadius)}" fill="${fill}" stroke="var(--background)" stroke-width="2.5"/><text x="${x}" y="${y}" dy=".36em" text-anchor="middle" font-size="13" font-weight="700" fill="var(--background)">${String(index + 1)}</text></g>`
    })
    .join("")
  const tips = arrows
    .map((line, index) =>
      line === null
        ? ""
        : `<g data-tip="${String(index + 1)}" data-x="${(line.to.x + frameMargin).toFixed(1)}" data-y="${(line.to.y + frameMargin).toFixed(1)}"></g>`,
    )
    .join("")
  return `<section class="side" data-side="${escape(side.key)}">${side.label ? `<div class="label">${escape(side.label)}</div>` : ""}
<div class="frame" style="width:${outer.width.toFixed(1)}px;height:${outer.height.toFixed(1)}px">
<img src="data:image/png;base64,${PNG.sync.write(side.png).toString("base64")}" style="left:${String(frameMargin)}px;top:${String(frameMargin)}px;width:${shape.width.toFixed(1)}px;height:${shape.height.toFixed(1)}px">
<svg width="${outer.width.toFixed(1)}" height="${outer.height.toFixed(1)}"><defs><marker id="tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="var(--callout)"/></marker></defs>${lines}${dots}${tips}</svg></div></section>`
}

export function blockHtml(block) {
  const { shape, circles, sides } = marks(block)
  const pair = block.sides.map((side, index) => sideHtml(side, shape, circles, sides[index])).join("")
  const legend = block.callouts
    .map((callout, index) => {
      const missing = block.sides.filter((side) => side.boxes[index] === null).map((side) => side.missing)
      const tail = missing.length > 0 ? ` <span class="missing">(${escape(missing.join("; "))})</span>` : ""
      return `<li><span class="number">${String(index + 1)}</span><span>${escape(callout.note)}${tail}</span></li>`
    })
    .join("")
  const reason = block.reason ? `<p class="reason">${escape(block.reason)}</p>` : ""
  return `<article data-block="${escape(block.state)}"><h2>${escape(block.title)}${block.badge ? `<span class="badge ${block.badge.outcome}">${escape(block.badge.text)}</span>` : ""}</h2>
<div class="pair${shape.sideBySide ? " beside" : ""}">${pair}</div>${reason}${legend ? `<ol>${legend}</ol>` : ""}</article>`
}

export function pageHtml(articles, css) {
  return `<!doctype html><meta charset="utf-8"><style>${css}:root{--callout:var(--limit)}${style}</style><main>${articles.join("\n")}</main>`
}

export function groups(heights, cap = heightCap / imageScale) {
  const parts = []
  let current = []
  let used = between
  for (const [index, height] of heights.entries()) {
    if (current.length > 0 && used + height + between > cap) {
      parts.push(current)
      current = []
      used = between
    }
    current.push(index)
    used += height + between
  }
  if (current.length > 0) parts.push(current)
  return parts
}

export async function renderBlocks(browser, blocks, css, files) {
  const context = await browser.newContext({
    viewport: { width: pageWidth, height: 1000 },
    deviceScaleFactor: imageScale,
    reducedMotion: "reduce",
  })
  try {
    const page = await context.newPage()
    const articles = blocks.map(blockHtml)
    const settle = async (html) => {
      await page.setContent(html)
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map((image) => image.decode()))
      })
    }
    await settle(pageHtml(articles, css))
    const heights = await page.locator("article").evaluateAll((all) => all.map((each) => each.offsetHeight))
    const written = []
    for (const [index, part] of groups(heights).entries()) {
      await settle(
        pageHtml(
          part.map((at) => articles[at]),
          css,
        ),
      )
      const file = files(index)
      await page.locator("main").screenshot({ path: file })
      written.push(file)
    }
    return written
  } finally {
    await context.close()
  }
}
