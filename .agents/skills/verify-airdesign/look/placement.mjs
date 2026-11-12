export const circleRadius = 13
export const arrowGap = 30
export const frameMargin = 30
export const tipGap = 3

const directions = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

function spotFor(box, [dx, dy], reach) {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const x = dx < 0 ? box.x - reach : dx > 0 ? box.x + box.width + reach : cx
  const y = dy < 0 ? box.y - reach : dy > 0 ? box.y + box.height + reach : cy
  const diagonal = dx !== 0 && dy !== 0
  return diagonal ? { x: x + (dx * -reach) / 3, y: y + (dy * -reach) / 3 } : { x, y }
}

function nearest(box, point) {
  return {
    x: Math.min(Math.max(point.x, box.x), box.x + box.width),
    y: Math.min(Math.max(point.y, box.y), box.y + box.height),
  }
}

function touches(box, point, radius) {
  const near = nearest(box, point)
  return Math.hypot(near.x - point.x, near.y - point.y) < radius
}

function freeSpace(box, [dx, dy], area) {
  const across = dx < 0 ? box.x : dx > 0 ? area.width - box.x - box.width : Infinity
  const down = dy < 0 ? box.y : dy > 0 ? area.height - box.y - box.height : Infinity
  return Math.min(across, down)
}

export function place(targets, area, { radius = circleRadius, gap = arrowGap, margin = frameMargin } = {}) {
  const placed = []
  const reach = gap + radius
  return targets.map((box) => {
    if (box === null) return null
    let best
    for (const [order, direction] of directions.entries()) {
      const spot = spotFor(box, direction, reach)
      const outside =
        spot.x < -margin + radius ||
        spot.y < -margin + radius ||
        spot.x > area.width + margin - radius ||
        spot.y > area.height + margin - radius
      if (outside) continue
      const inMargin =
        spot.x < radius || spot.y < radius || spot.x > area.width - radius || spot.y > area.height - radius
      const covers = targets.filter((other) => other !== null && touches(other, spot, radius + 4)).length
      const crowds = placed.filter((other) => Math.hypot(other.x - spot.x, other.y - spot.y) < radius * 2 + 6).length
      const room = Math.min(freeSpace(box, direction, area), 240)
      const score = covers * 1000 + crowds * 1000 + (inMargin ? 60 : 0) - room / 8 + order
      if (best === undefined || score < best.score) best = { ...spot, score }
    }
    const spot = best === undefined ? spotFor(box, [-1, 0], reach) : { x: best.x, y: best.y }
    placed.push(spot)
    return spot
  })
}

export function arrow(circle, box, radius = circleRadius) {
  const tip = nearest(box, circle)
  const dx = tip.x - circle.x
  const dy = tip.y - circle.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  return {
    from: { x: circle.x + ux * (radius + 2), y: circle.y + uy * (radius + 2) },
    to: { x: tip.x - ux * tipGap, y: tip.y - uy * tipGap },
  }
}

export function relative(box, crop) {
  if (box === null) return null
  const x = Math.max(box.x, crop.x)
  const y = Math.max(box.y, crop.y)
  const right = Math.min(box.x + box.width, crop.x + crop.width)
  const bottom = Math.min(box.y + box.height, crop.y + crop.height)
  if (right <= x || bottom <= y) return null
  return { x: x - crop.x, y: y - crop.y, width: right - x, height: bottom - y }
}

export function scaled(box, scale) {
  return box === null
    ? null
    : { x: box.x * scale, y: box.y * scale, width: box.width * scale, height: box.height * scale }
}
