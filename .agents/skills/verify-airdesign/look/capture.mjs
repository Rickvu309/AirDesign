import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { PNG } from "pngjs"
import { settle } from "../bin/browser.mjs"
import { annotated, crop, savePng } from "./images.mjs"
import { scan } from "./scan.mjs"

export const signOff = "Zero findings is not a design sign-off. Open the images and say what you see."

export function brief(findings, count = 5) {
  return findings
    .slice(0, count)
    .map(
      (finding) =>
        `${finding.number}. rank ${finding.rank} ${finding.detector} at ${finding.selector}: ${finding.message}`,
    )
}

export async function captureLook(page, out, options = {}) {
  mkdirSync(out, { recursive: true })
  await settle(page)
  const result = await scan(page, options)
  const image = PNG.sync.read(await page.screenshot({ path: path.join(out, "page.png"), animations: "disabled" }))
  const scale = image.width / page.viewportSize().width
  const findings = result.findings.map((finding) => {
    const file = path.join(out, `${String(finding.number).padStart(2, "0")}-${finding.detector}.png`)
    savePng(file, crop(image, finding.box, scale))
    return { ...finding, crop: file }
  })
  savePng(path.join(out, "annotated.png"), annotated(image, findings, scale))
  const report = { page: page.url(), scope: result.scope, viewport: page.viewportSize(), scale, findings, signOff }
  writeFileSync(path.join(out, "findings.json"), `${JSON.stringify(report, null, 2)}\n`)
  return {
    count: findings.length,
    page: path.join(out, "page.png"),
    annotated: path.join(out, "annotated.png"),
    findings: path.join(out, "findings.json"),
    top: brief(findings),
    report,
    used: result.used,
  }
}

export async function themeValues(page, repo) {
  const css = readFileSync(path.join(repo, "packages/theme/src/tokens.css"), "utf8")
  const names = [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]))]
  return page.evaluate((names) => {
    const probe = document.createElement("span")
    document.body.append(probe)
    const read = (property, value) => {
      probe.style.setProperty(property, value)
      const computed = getComputedStyle(probe).getPropertyValue(property)
      probe.style.removeProperty(property)
      return computed
    }
    const colors = new Set(["rgba(0, 0, 0, 0)"])
    const sizes = new Set()
    const radii = new Set(["0px"])
    const spaces = new Set(["0px"])
    for (const name of names) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      if (!value) continue
      if (CSS.supports("color", value)) colors.add(read("color", `var(${name})`))
      else if (/^--(?:type|text|font-size)/.test(name)) sizes.add(read("font-size", `var(${name})`))
      else if (/radius|shape/.test(name)) radii.add(read("border-top-left-radius", `var(${name})`))
      else if (/^-?[\d.]+(px|rem)$/.test(value)) spaces.add(read("padding-top", `var(${name})`))
    }
    probe.remove()
    return { colors: [...colors], sizes: [...sizes], radii: [...radii], spaces: [...spaces] }
  }, names)
}
