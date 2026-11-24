export const emptyRegion = {
  name: "empty-region",
  rank: 1,
  reads: "the on-screen part of landmarks and panels, and the text, graphics, fields and fills inside that part",
  cannot:
    "a peek under 12% of the screen; whether blank space serves the design; a slide, the canvas around it and a filmstrip are meant to leave room",
  inspect: (element, page) => {
    const regions =
      'aside,main,section,[role="region"],[role="log"],[role="complementary"],[role="main"],[data-editor-panel],[data-aira-panel]'
    const meant = "[data-slide-paint],[data-editor-canvas],[data-canvas-stage],[data-slide-list],[data-editor-sidebar]"
    const share = 0.12
    const screen = page.width * page.height
    const area = (box) => box.width * box.height
    const shown = (at) => {
      const box = page.box(at)
      const left = Math.max(0, box.x)
      const top = Math.max(0, box.y)
      return {
        width: Math.max(0, Math.min(page.width, box.x + box.width) - left),
        height: Math.max(0, Math.min(page.height, box.y + box.height) - top),
      }
    }
    const empty = (region) => {
      if (!region.matches(regions) || region.matches(meant) || page.floating(region)) return null
      const seen = area(shown(region))
      if (seen < screen * share) return null
      const ground = page.style(region).backgroundColor
      let characters = 0
      let filled = 0
      for (const at of region.querySelectorAll("*")) {
        if (!page.visible(at)) continue
        const text = page.ownText(at)
        characters += text.length + (at.getAttribute("placeholder") ?? "").length
        const own = shown(at)
        if (text !== "") filled += own.width * Math.min(own.height, parseFloat(page.style(at).fontSize) * 1.5)
        else if (page.graphic(at) || ["input", "textarea", "select", "button"].includes(at.localName))
          filled += own.width * own.height
        else if (page.fill(at) && page.style(at).backgroundColor !== ground) filled += own.width * own.height
      }
      const used = Math.min(1, filled / seen)
      return characters < 24 && used < 0.1 ? used : null
    }
    const used = empty(element)
    if (used === null) return
    const inside = [...element.querySelectorAll(regions)].some((child) => page.visible(child) && empty(child) !== null)
    if (inside) return
    const percent = Math.round((area(shown(element)) / screen) * 100)
    return `A region covering ${percent}% of the screen shows almost nothing (${Math.round(used * 100)}% of it painted). Give it an empty state or content.`
  },
}
