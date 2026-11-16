export const overflowingText = {
  name: "overflowing-text",
  rank: 1,
  reads:
    "the painted boxes of an element's own text, clipping ancestors, what paints on top of the text, and other text painted over it",
  cannot:
    "text drawn in a canvas or image, covers that ignore the pointer, and text past a slide's own edge, which is off the slide as in PowerPoint",
  inspect: (element, page) => {
    if (page.thumbnail(element) || page.ownText(element) === "") return
    const rects = page.textRects(element)
    if (rects.length === 0) return
    const quote = page.ownText(element).slice(0, 80)
    for (let at = element.parentElement; at && at !== document.body; at = at.parentElement) {
      const style = page.style(at)
      if ([style.overflowX, style.overflowY].some((value) => value === "auto" || value === "scroll")) break
      if (at.matches("[data-slide-paint],[data-canvas-stage]")) break
      const clipX = ["hidden", "clip"].includes(style.overflowX)
      const clipY = ["hidden", "clip"].includes(style.overflowY)
      if (!clipX && !clipY) continue
      if (style.textOverflow === "ellipsis" || (style.webkitLineClamp !== "none" && style.webkitLineClamp !== ""))
        return
      const edge = at.getBoundingClientRect()
      const left = edge.left + at.clientLeft
      const top = edge.top + at.clientTop
      const right = left + at.clientWidth
      const bottom = top + at.clientHeight
      const cut = rects.find(
        (rect) =>
          (clipX && (rect.left < left - 1 || rect.right > right + 1)) ||
          (clipY && (rect.top < top - 1 || rect.bottom > bottom + 1)),
      )
      if (cut) return `Text "${quote}" runs past the visible box of ${page.describe(at)}, so part of it is cut off.`
    }
    if (page.floating(element)) return
    for (const rect of rects) {
      for (const share of [0.15, 0.5, 0.85]) {
        const x = rect.left + rect.width * share
        const y = rect.top + rect.height * 0.55
        if (x < 0 || y < 0 || x >= page.width || y >= page.height) continue
        const stack = document.elementsFromPoint(x, y)
        const own = stack.findIndex((hit) => hit === element || element.contains(hit))
        if (own <= 0) continue
        const cover = stack
          .slice(0, own)
          .find(
            (hit) =>
              !hit.contains(element) &&
              !page.raised(hit, element) &&
              (page.graphic(hit) || page.rgba(page.style(hit).backgroundColor)[3] > 0.9),
          )
        if (cover) return `Text "${quote}" is painted under ${page.describe(cover)}, so part of it is hidden.`
      }
    }
    const shown = page.shownRects(element)
    const texts = page.memo("texts", () =>
      page.elements
        .filter((each) => !page.thumbnail(each) && page.ownText(each) !== "")
        .map((each) => ({ each, rects: page.shownRects(each) })),
    )
    for (const { each, rects: others } of texts) {
      if (each === element || each.contains(element) || element.contains(each)) continue
      if (!(element.compareDocumentPosition(each) & Node.DOCUMENT_POSITION_FOLLOWING) || page.raised(each, element))
        continue
      const hit = shown.some((rect) =>
        others.some((other) => {
          const wide = Math.min(rect.right, other.right) - Math.max(rect.left, other.left)
          const tall = Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top)
          const smaller = Math.min(rect.width * rect.height, other.width * other.height)
          return wide > 0 && tall > 0 && wide * tall >= smaller * 0.3
        }),
      )
      if (hit) return `Text "${quote}" and ${page.describe(each)} are painted over each other.`
    }
  },
}
