export type GridViewport = { readonly x: number; readonly y: number; readonly scale: number }

export function zoomedGrid(
  view: GridViewport,
  scale: number,
  anchor: { readonly x: number; readonly y: number },
): GridViewport {
  const ratio = scale / view.scale
  return { x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio, scale }
}

export type GridBounds = { readonly width: number; readonly height: number }
type GridRect = GridBounds & { readonly left: number; readonly top: number }
type GridDelta = { readonly x: number; readonly y: number }

export function pannedGrid(view: GridViewport, delta: GridDelta): GridViewport {
  return { ...view, x: view.x + delta.x, y: view.y + delta.y }
}

export function boundedGridScale(scale: number): number {
  return Math.max(0.1, Math.min(4, scale))
}

export function fittedGrid(bounds: GridBounds, room: GridBounds): GridViewport {
  const scale = Math.min((room.width - 96) / Math.max(1, bounds.width), (room.height - 96) / Math.max(1, bounds.height))
  return { x: (room.width - bounds.width * scale) / 2, y: (room.height - bounds.height * scale) / 2, scale }
}

export function revealedGrid(view: GridViewport, box: GridRect, room: GridRect): GridViewport {
  function delta(start: number, size: number, edge: number, length: number) {
    if (size > length - 48) return edge + (length - size) / 2 - start
    if (start < edge + 24) return edge + 24 - start
    if (start + size > edge + length - 24) return edge + length - 24 - start - size
    return 0
  }
  return pannedGrid(view, {
    x: delta(box.left, box.width, room.left, room.width),
    y: delta(box.top, box.height, room.top, room.height),
  })
}

export function fittedGridCards(view: GridViewport, cards: readonly GridRect[], room: GridRect): GridViewport {
  if (cards.length === 0) return view
  const left = Math.min(...cards.map((card) => card.left))
  const top = Math.min(...cards.map((card) => card.top))
  const width = (Math.max(...cards.map((card) => card.left + card.width)) - left) / view.scale
  const height = (Math.max(...cards.map((card) => card.top + card.height)) - top) / view.scale
  const fit = fittedGrid({ width, height }, room)
  return {
    x: fit.x - ((left - room.left - view.x) / view.scale) * fit.scale,
    y: fit.y - ((top - room.top - view.y) / view.scale) * fit.scale,
    scale: fit.scale,
  }
}
