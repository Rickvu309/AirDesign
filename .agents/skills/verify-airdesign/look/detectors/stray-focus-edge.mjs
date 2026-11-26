export const strayFocusEdge = {
  name: "stray-focus-edge",
  rank: 1,
  reads:
    "the focused control that is not a field a person types in: its outline while the app keeps focus quiet, or at any time on a menu, list or dialog panel that Tab cannot reach",
  cannot:
    "a ring on a control that does not have focus during the scan, and a ring drawn as a border or shadow instead of an outline",
  inspect: (element, page) => {
    if (document.activeElement !== element || element === document.body) return
    const quiet = document.documentElement.hasAttribute("data-quiet-focus")
    const unreachable = element.matches(
      '[tabindex="-1"]:is([role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"])',
    )
    if (!quiet && !unreachable) return
    const typing =
      element.matches(
        'input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="color"], [type="file"]), textarea',
      ) || element.isContentEditable
    if (typing || element.matches('[aria-invalid="true"]')) return
    const style = page.style(element)
    if (
      style.outlineStyle === "none" ||
      !(parseFloat(style.outlineWidth) > 0) ||
      page.rgba(style.outlineColor)[3] <= 0.1
    )
      return
    return unreachable
      ? "This panel shows a focus ring around its whole box, and Tab cannot reach it. Code put focus here, so nothing may ring it."
      : "This control shows a focus ring though Tab did not bring focus to it. The page keeps focus quiet until Tab."
  },
}
