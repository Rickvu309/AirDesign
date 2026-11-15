const decoder = new TextDecoder()
const turnTolerance = 0.01

function painted(pptx, parts, part) {
  return new Map(
    pptx
      .paintReader(parts)
      .slide(part)
      .elements.filter((row) => row.from === "slide")
      .map((row) => [row.shape, row]),
  )
}

function samePlace(left, right) {
  if (left === null || right === null) return left === right
  const sides = ["x", "y", "width", "height"].every((side) => Math.abs(left[side] - right[side]) <= 2)
  const turn = Math.abs(((left.rotation - right.rotation + 540) % 360) - 180) <= turnTolerance
  return sides && turn && left.flipH === right.flipH && left.flipV === right.flipV
}

function ungroupings(elements, slide) {
  const groups = elements.filter((each) => each.kind === "group" && each.node.startsWith(`${slide}.`))
  const steps = []
  let waiting = groups.filter((each) => !each.grouped)
  while (waiting.length > 0) {
    const [next, ...rest] = waiting
    steps.push(next)
    waiting = [...rest, ...groups.filter((each) => each.group === next.node)]
  }
  return steps
}

export function groupLines({ pptx, parts }) {
  const name = "doe-heat-pumps.pptx"
  const pack = parts.get(name)
  if (pack === undefined) return [`group missing ${name}`]
  const { slides, elements } = pptx.indexPackage(pack)
  const file = slides.map((slide) => slide.id)
  const index = { total: elements.length, slides, elements, pages: [] }
  const lines = []
  let checked = 0
  for (const { slide, part } of pptx.readSlides(pack)) {
    const shown = painted(pptx, pack, part)
    const order = []
    for (const group of ungroupings(elements, slide)) {
      order.push({ slide: "element-ungroup", id: slide, node: group.node })
      const regroups = order.toReversed().map((each) => ({ ...each, slide: "element-regroup" }))
      let apart
      let back
      try {
        apart = pptx.orderedParts(pack, { file, index, order })
        back = pptx.orderedParts(pack, { file, index, order: [...order, ...regroups] })
      } catch (error) {
        lines.push(`group ${group.node} threw ${error instanceof Error ? error.message : "unknown"}`)
        continue
      }
      checked += 1
      const after = painted(pptx, apart, part)
      if (after.has(group.node.split(".")[1])) lines.push(`group ${group.node} still paints after it was ungrouped`)
      for (const child of elements.filter((each) => each.node.startsWith(`${slide}.`) && each.kind !== "group")) {
        const id = child.node.split(".")[1]
        if (!samePlace(shown.get(id)?.box ?? null, after.get(id)?.box ?? null))
          lines.push(`group ${group.node} moved ${child.node} when it was ungrouped`)
      }
      for (const [other, bytes] of pack) {
        if (other !== part && apart.get(other) !== bytes) lines.push(`group ${group.node} rewrote ${other}`)
      }
      if (decoder.decode(back.get(part)) !== decoder.decode(pack.get(part)))
        lines.push(`group ${group.node} did not come back byte for byte when each ungroup was undone`)
    }
  }
  if (checked < 6) lines.push(`group checked only ${checked} groups in ${name}`)
  return lines
}
