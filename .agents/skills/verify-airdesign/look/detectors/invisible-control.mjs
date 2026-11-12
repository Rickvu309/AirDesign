export const invisibleControl = {
  name: "invisible-control",
  rank: 1,
  reads:
    "focusable and editable elements, their text, placeholder, border, fill, graphics, a tight painted wrapper, and what paints inside their box",
  cannot:
    "whether a painted control is understandable, and placeholders drawn only by a pseudo-element without content",
  inspect: (element, page) => {
    const editable = element.isContentEditable && element.getAttribute("contenteditable") !== null
    const focusable = element.tabIndex >= 0 || editable || element.matches("input,textarea,select,button,a[href]")
    if (!focusable || element.matches(':disabled,[aria-disabled="true"]') || element.closest("[inert]")) return
    const own = page.box(element)
    if (own.width < 4 || own.height < 4 || page.thumbnail(element)) return
    if (page.fill(element) || page.frameBox(element) !== null) return
    if ((element.getAttribute("placeholder") ?? "").trim() !== "") return
    if ((element.getAttribute("aria-placeholder") ?? "").trim() !== "") return
    for (const pseudo of ["::before", "::after", "::placeholder"]) {
      const s = getComputedStyle(element, pseudo)
      if (s.content !== "none" && s.content !== "normal" && s.content !== '""') return
    }
    if (page.text(element) !== "" || (element.value ?? "").toString().trim() !== "") return
    for (const at of element.querySelectorAll("*"))
      if (page.visible(at) && (page.graphic(at) || page.fill(at) || page.frameBox(at) !== null)) return
    for (let at = element.parentElement; at && at !== document.body; at = at.parentElement) {
      const wrapper = page.box(at)
      if (wrapper.width * wrapper.height > own.width * own.height * 4) break
      if (page.frameBox(at) !== null) return
      if (page.fill(at) && page.style(at).backgroundColor !== page.style(at.parentElement ?? at).backgroundColor) return
    }
    const points = [
      [0.5, 0.5],
      [0.25, 0.25],
      [0.75, 0.75],
    ]
    for (const [sx, sy] of points) {
      const hits = document.elementsFromPoint(own.x + own.width * sx, own.y + own.height * sy)
      const beneath = hits.find(
        (hit) =>
          hit !== element &&
          !hit.contains(element) &&
          (page.graphic(hit) || page.ownText(hit) !== "" || page.frameBox(hit) !== null),
      )
      if (beneath) return
    }
    const kind = editable ? "An editable area" : "A control"
    return `${kind} of ${Math.round(own.width)} by ${Math.round(own.height)} px paints nothing: no text, placeholder, border, fill or icon shows that it is there.`
  },
}
