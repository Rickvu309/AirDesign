const edge = 56

const fastest = 24

export function dropPlace(x: number, card: { readonly left: number; readonly width: number }, index: number): number {
  return x < card.left + card.width / 2 ? index : index + 1
}

export function dropTarget(from: number, place: number): number | null {
  const to = place > from ? place - 1 : place
  return to === from ? null : to
}

export function edgeScroll(y: number, list: { readonly top: number; readonly height: number }): number {
  const fromTop = y - list.top
  const fromBottom = list.top + list.height - y
  if (fromTop < edge) return -Math.ceil((fastest * (edge - Math.max(fromTop, 0))) / edge)
  if (fromBottom < edge) return Math.ceil((fastest * (edge - Math.max(fromBottom, 0))) / edge)
  return 0
}
