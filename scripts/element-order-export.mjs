const text = (bytes) => new TextDecoder().decode(bytes)

function directChildren(pptx, bytes) {
  const { elements } = pptx.requireMarkup(bytes)
  return elements
    .filter((element) => element.kind === "p:spTree" || element.kind === "p:grpSp")
    .map((parent) =>
      elements
        .filter((element) => element.parent === parent.index)
        .map((element) => text(bytes.subarray(element.start, element.end))),
    )
}

function sameMultiset(left, right) {
  const rest = [...right]
  for (const piece of left) {
    const at = rest.indexOf(piece)
    if (at < 0) return false
    rest.splice(at, 1)
  }
  return rest.length === 0
}

function sameBytes(left, right) {
  if (left === undefined || right === undefined || left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) if (left[index] !== right[index]) return false
  return true
}

export function elementOrderLines({ pptx, parts }) {
  const name = "census-updating-spm.pptx"
  const pack = parts.get(name)
  if (pack === undefined) return [`element order missing ${name}`]
  const shapes = pptx.readShapes(pack)
  const slides = pptx.readSlides(pack)
  let picked = null
  for (const slide of slides) {
    const onSlide = shapes.filter((shape) => shape.slide === slide.slide)
    const seen = new Set()
    for (const shape of onSlide) {
      const node = `${slide.slide}.${shape.shape}`
      if (seen.has(node)) continue
      const among = pptx.shapeSiblings(pack, node)
      if (among === null || among.length < 2) continue
      for (const id of among) seen.add(String(id))
      const kinds = new Set(
        among.map((id) => onSlide.find((each) => `${each.slide}.${each.shape}` === String(id))?.kind),
      )
      if (!kinds.has("p:grpSp") || !kinds.has("p:graphicFrame")) continue
      picked = { slide: slide.slide, part: slide.part, node: String(among[0]), among }
      break
    }
    if (picked !== null) break
  }
  if (picked === null) return [`element order found no group beside a graphic frame in ${name}`]
  let changed
  try {
    changed = pptx.orderedParts(pack, {
      file: slides.map((slide) => slide.slide),
      order: [
        {
          slide: "element-order",
          id: picked.slide,
          node: picked.node,
          before: null,
          among: picked.among,
        },
      ],
    })
  } catch (error) {
    return [`element order threw ${error instanceof Error ? error.message : "unknown"}`]
  }
  const lines = []
  for (const [part, bytes] of pack) {
    if (part !== picked.part && !sameBytes(changed.get(part), bytes)) lines.push(`element order rewrote ${part}`)
  }
  const before = pack.get(picked.part)
  const after = changed.get(picked.part)
  if (before === undefined || after === undefined) return [...lines, "element order lost the slide"]
  const beforeTrees = directChildren(pptx, before)
  const afterTrees = directChildren(pptx, after)
  if (beforeTrees.length !== afterTrees.length) lines.push("element order changed how many shape trees there are")
  let moved = false
  for (let index = 0; index < beforeTrees.length; index += 1) {
    const left = beforeTrees[index] ?? []
    const right = afterTrees[index] ?? []
    if (!sameMultiset(left, right)) {
      lines.push("element order dropped or duplicated a shape tree child")
      continue
    }
    if (left.some((piece, at) => piece !== right[at])) moved = true
  }
  if (!moved) lines.push("element order left the shape tree in the same order")
  const timing = /<p:timing\b[\s\S]*?<\/p:timing>/.exec(text(before))?.[0]
  if (timing !== undefined && !text(after).includes(timing)) lines.push("element order rewrote the slide timing")
  return lines
}
