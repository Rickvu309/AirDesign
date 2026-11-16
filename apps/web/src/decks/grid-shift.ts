import { flushSync } from "react-dom"

function cards(grid: HTMLElement | null) {
  return [...(grid?.querySelectorAll<HTMLElement>("[data-deck]") ?? [])]
}

export function clearGridShift(grid: HTMLElement | null) {
  for (const card of cards(grid)) {
    card.style.transition = "none"
    card.style.transform = "none"
    card.style.opacity = "1"
  }
  document.querySelectorAll("[data-deck-exit]").forEach((card) => card.remove())
}

export function gridShift(grid: () => HTMLElement | null, change: () => void) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    change()
    return
  }
  const before = new Map(
    cards(grid()).map((card) => [
      card.dataset.deck,
      {
        card,
        rect: card.getBoundingClientRect(),
        opacity: getComputedStyle(card).opacity,
      },
    ]),
  )
  const theme = getComputedStyle(grid() ?? document.documentElement)
  const shift = theme.getPropertyValue("--ease-grid").trim()
  const micro = theme.getPropertyValue("--ease-micro").trim()
  clearGridShift(grid())
  flushSync(change)
  const after = cards(grid()).map((card) => ({ card, rect: card.getBoundingClientRect() }))
  const moving = []
  for (const { card, rect } of after) {
    const previous = before.get(card.dataset.deck)
    card.style.transition = "none"
    card.style.transform = previous
      ? `translate(${previous.rect.x - rect.x}px, ${previous.rect.y - rect.y}px)`
      : "scale(0.97)"
    card.style.opacity = previous?.opacity ?? "0"
    moving.push({ card, exit: false })
  }
  for (const { card, rect, opacity } of before.values()) {
    if (card.isConnected) continue
    const copy = card.cloneNode(true)
    if (!(copy instanceof HTMLElement)) continue
    copy.removeAttribute("data-deck")
    copy.setAttribute("data-deck-exit", "")
    copy.setAttribute("aria-hidden", "true")
    copy.inert = true
    Object.assign(copy.style, {
      position: "fixed",
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: "0",
      pointerEvents: "none",
      transition: "none",
      transform: "none",
      opacity,
    })
    document.body.append(copy)
    copy.addEventListener("transitionend", () => copy.remove(), { once: true })
    copy.addEventListener("transitioncancel", () => copy.remove(), { once: true })
    moving.push({ card: copy, exit: true })
  }
  void document.body.offsetHeight
  for (const { card, exit } of moving) {
    card.style.transition = `transform ${exit ? micro : shift}, opacity ${micro}`
    card.style.transform = exit ? "scale(0.97)" : "none"
    card.style.opacity = exit ? "0" : "1"
  }
}
