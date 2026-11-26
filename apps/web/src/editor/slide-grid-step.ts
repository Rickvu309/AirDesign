export type GridPlace = { readonly left: number; readonly top: number }

export function gridStep(key: string, places: readonly GridPlace[], at: number): number {
  const here = places[at]
  if (here === undefined) return at
  if (key === "Home") return 0
  if (key === "End") return places.length - 1
  if (key === "ArrowLeft") return Math.max(at - 1, 0)
  if (key === "ArrowRight") return Math.min(at + 1, places.length - 1)
  const lines = [...new Set(places.map((place) => place.top))].sort((a, b) => a - b)
  const line = lines[lines.indexOf(here.top) + (key === "ArrowDown" ? 1 : -1)]
  if (line === undefined) return at
  return places.reduce((best, place, index) => {
    if (place.top !== line) return best
    const nearest = places[best]
    if (nearest === undefined || nearest.top !== line) return index
    return Math.abs(place.left - here.left) < Math.abs(nearest.left - here.left) ? index : best
  }, at)
}
