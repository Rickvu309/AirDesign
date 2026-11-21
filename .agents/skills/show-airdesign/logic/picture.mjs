import { scan } from "../../verify-airdesign/look/scan.mjs"

export async function drawPicture(page, html) {
  await page.setContent(html)
  await page.evaluate(async () => {
    await document.fonts.load('16px "Inter Variable"')
    await document.fonts.ready
    await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)))
    for (const photo of document.querySelectorAll(".thumb")) photo.style.width = `${String(photo.naturalWidth / 2)}px`
  })
}

function inPicture(selectors) {
  const picture = document.querySelector("main")
  const edge = picture.getBoundingClientRect()
  const at = (element) => {
    const point = element.closest("li")?.querySelector("b")
    if (point) return point.textContent
    const box = element.closest(".box")
    if (box) return box.querySelector(".badge")?.textContent ?? "answer"
    return element.closest(".answer") ? "answer" : "page"
  }
  const faults = []
  for (const photo of picture.querySelectorAll(".thumb")) {
    const full = photo.naturalWidth / 2
    if (full === 0)
      faults.push({
        fault: "photo-missing",
        at: at(photo),
        message: "The photo did not load, so its box shows nothing.",
      })
    else if (photo.clientWidth < full - 1)
      faults.push({
        fault: "photo-shrunk",
        at: at(photo),
        message: `The photo is drawn at ${String(Math.round((photo.clientWidth / full) * 100))}% of its size, so its text is too small to read. Crop it to at most ${String(photo.clientWidth * 2)} px wide.`,
      })
  }
  for (const text of picture.querySelectorAll(".claim,.points li"))
    if (text.scrollWidth > text.clientWidth + 1)
      faults.push({
        fault: "text-past-box",
        at: at(text),
        message: `"${text.textContent.trim().slice(0, 60)}" runs past the side of its box. Use shorter words.`,
      })
  for (const part of picture.querySelectorAll("*")) {
    const rect = part.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    const past =
      rect.left < edge.left - 1 ||
      rect.top < edge.top - 1 ||
      rect.right > edge.right + 1 ||
      rect.bottom > edge.bottom + 1
    if (past)
      faults.push({
        fault: "past-edge",
        at: at(part),
        message: "A part of this box is drawn past the picture's edge, so the image cuts it.",
      })
  }
  return { faults, places: selectors.map((selector) => at(document.querySelector(selector) ?? picture)) }
}

export async function pictureFaults(page) {
  const { findings } = await scan(page, { scope: "/logic", allow: [] })
  const { faults, places } = await page.evaluate(
    inPicture,
    findings.map((finding) => finding.selector),
  )
  return [
    ...faults,
    ...findings.map((finding, index) => ({
      fault: finding.detector,
      at: places[index],
      message: finding.more > 0 ? `${finding.message} ${String(finding.more)} more like it.` : finding.message,
    })),
  ]
}
