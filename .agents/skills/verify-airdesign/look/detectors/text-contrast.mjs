export const textContrast = {
  name: "text-contrast",
  rank: 2,
  reads:
    "the text color and every solid layer painted under the text's middle, composited, against the WCAG AA ratio for its size and weight",
  cannot: "text over an image, gradient, canvas, filter or translucent layer, text on slides, and disabled controls",
  inspect: (element, page) => {
    if (page.ownText(element) === "" || page.content(element) || element.closest("[data-canvas-stage]")) return
    if (element.closest(':disabled,[aria-disabled="true"],[inert]') !== null) return
    const rect = page.textRects(element)[0]
    if (rect === undefined) return
    const stack = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
    const own = stack.indexOf(element)
    const below = own === -1 ? [] : stack.slice(own)
    for (let at = element.parentElement; own === -1 && at; at = at.parentElement) below.push(at)
    if (own === -1) below.unshift(element)
    const layers = []
    for (const at of below) {
      const s = page.style(at)
      const unknown =
        s.backgroundImage !== "none" || s.filter !== "none" || s.mixBlendMode !== "normal" || Number(s.opacity) < 1
      if (unknown || (page.graphic(at) && at !== element)) return
      const color = page.rgba(s.backgroundColor)
      layers.push(color)
      if (color[3] >= 1) break
    }
    const over = (front, back) => front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3]))
    const ground = layers.reverse().reduce((back, front) => over(front, back), [255, 255, 255])
    const style = page.style(element)
    const ink = over(page.rgba(style.color), ground)
    const light = (color) =>
      color
        .map((value) => value / 255)
        .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0)
    const [high, low] = [light(ink), light(ground)].sort((a, b) => b - a)
    const ratio = (high + 0.05) / (low + 0.05)
    const size = parseFloat(style.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700)
    const needed = large ? 3 : 4.5
    if (ratio >= needed - 0.005) return
    return `Text "${page.ownText(element).slice(0, 60)}" has contrast ${ratio.toFixed(2)}:1 against its background; WCAG AA needs ${needed}:1 at ${size}px.`
  },
}
