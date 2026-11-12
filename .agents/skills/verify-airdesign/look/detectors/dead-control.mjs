export const deadControl = {
  name: "dead-control",
  rank: 2,
  reads:
    "enabled buttons and links: href, form and label wiring, onclick, and React handler props on the element and its ancestors",
  cannot:
    "listeners added with addEventListener or delegated to the document, so a finding is a candidate to click, not proof",
  inspect: (element, page) => {
    if (!element.matches('button,a,[role="button"],[role="link"],[role="menuitem"],[role="tab"],summary')) return
    if (element.matches(':disabled,[aria-disabled="true"]') || element.closest("[inert]") || page.thumbnail(element))
      return
    if (element.hasAttribute("href") || element.closest("label,summary,details") !== null) return
    if (
      element.matches("button") &&
      element.type !== "button" &&
      (element.form !== null || element.hasAttribute("form"))
    )
      return
    const handlers = ["onClick", "onPointerDown", "onPointerUp", "onMouseDown", "onMouseUp", "onKeyDown", "onSubmit"]
    for (let at = element; at && at !== document.body; at = at.parentElement) {
      if (typeof at.onclick === "function" || typeof at.onpointerdown === "function") return
      const props = Object.keys(at)
        .filter((key) => key.startsWith("__reactProps$"))
        .map((key) => at[key])
      if (props.some((prop) => handlers.some((name) => typeof prop?.[name] === "function"))) return
    }
    const name = element.getAttribute("aria-label") ?? page.text(element)
    return `The control "${name.slice(0, 60)}" has no href, form, onclick or React handler on it or above it. Click it to confirm it does nothing.`
  },
}
