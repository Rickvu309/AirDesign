export const emptyRegion = {
  name: "empty-region",
  rank: 1,
  reads:
    "landmarks and panels that take a large share of the screen, and the text, graphics, fields and fills inside them",
  cannot:
    "whether blank space serves the design; a slide, the canvas around it and a filmstrip are meant to leave room",
  inspect: (element, page) => {
    const regions =
      'aside,main,section,[role="region"],[role="log"],[role="complementary"],[role="main"],[data-editor-panel],[data-aira-panel]'
    const meant = "[data-slide-paint],[data-editor-canvas],[data-canvas-stage],[data-slide-list],[data-editor-sidebar]"
    const share = 0.12
    const area = (at) => page.box(at).width * page.box(at).height
    const empty = (region) => {
      if (!region.matches(regions) || region.matches(meant) || page.floating(region)) return null
      if (area(region) < page.width * page.height * share) return null
      const ground = page.style(region).backgroundColor
      let characters = 0
      let filled = 0
      for (const at of region.querySelectorAll("*")) {
        if (!page.visible(at)) continue
        const text = page.ownText(at)
        characters += text.length
        const placeholder = at.getAttribute("placeholder") ?? ""
        characters += placeholder.length
        const own = page.box(at)
        if (text !== "") filled += own.width * Math.min(own.height, parseFloat(page.style(at).fontSize) * 1.5)
        else if (page.graphic(at) || ["input", "textarea", "select", "button"].includes(at.localName))
          filled += own.width * own.height
        else if (page.fill(at) && page.style(at).backgroundColor !== ground) filled += own.width * own.height
      }
      const used = Math.min(1, filled / area(region))
      return characters < 24 && used < 0.1 ? used : null
    }
    const used = empty(element)
    if (used === null) return
    const inside = [...element.querySelectorAll(regions)].some((child) => page.visible(child) && empty(child) !== null)
    if (inside) return
    const percent = Math.round((area(element) / (page.width * page.height)) * 100)
    return `A region covering ${percent}% of the screen shows almost nothing (${Math.round(used * 100)}% of it painted). Give it an empty state or content.`
  },
}
