export const focusVisible = {
  name: "focus-visible",
  rank: 2,
  reads:
    "the focused control in the tab order when the browser treats its focus as visible: its outline, and every :focus, :focus-visible and :focus-within rule that paints it or a close ancestor",
  cannot: "focus states the page was not put in; only the control that has focus during the scan is judged",
  inspect: (element, page) => {
    if (document.activeElement !== element || element === document.body || !element.matches(":focus-visible")) return
    if (element.tabIndex < 0) return
    const typing = element.matches("input,textarea,select") || element.isContentEditable
    if (typing && page.style(element).caretColor !== "transparent") return
    const style = page.style(element)
    if (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0 && page.rgba(style.outlineColor)[3] > 0.1)
      return
    const painting = /^(outline|box-shadow|border|background|--tw-ring|--tw-shadow|text-decoration|color)/
    const rules = page.memo("focus rules", () => {
      const found = []
      const walk = (list) => {
        for (const rule of list) {
          if (rule.cssRules) walk(rule.cssRules)
          if (
            rule.selectorText &&
            /:focus/.test(rule.selectorText) &&
            [...rule.style].some((name) => painting.test(name))
          )
            found.push(rule)
        }
      }
      for (const sheet of document.styleSheets) {
        try {
          walk(sheet.cssRules)
        } catch {
          found.push(null)
        }
      }
      return found
    })
    const close = []
    for (let at = element, depth = 0; at && depth < 4; at = at.parentElement, depth += 1) close.push(at)
    const matches = (rule, at) => {
      try {
        return at.matches(rule.selectorText)
      } catch {
        return false
      }
    }
    if (rules.some((rule) => rule !== null && close.some((at) => matches(rule, at)))) return
    return "This control has keyboard focus and nothing shows it: no outline, ring, border or background change."
  },
}
