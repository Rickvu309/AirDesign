const faceName = (id) => "AD-" + id
const apply = (span, run, selected) => {
  span.style.fontFamily = (selected ? [selected] : run.faces).map((val) => JSON.stringify(faceName(val))).join(",")
  if (run.local && !selected) span.style.fontFamily = JSON.stringify(run.local) + "," + span.style.fontFamily
  span.style.fontFamily += ", system-ui, sans-serif"
  span.style.fontSize = run.size + "px"
  span.style.fontWeight = run.weight
  span.style.letterSpacing = (run.tracking ?? 0) + "px"
  span.style.fontVariationSettings = '"opsz" 32'
}
const paint = (parent, runs, start, end, pieces) => {
  if (pieces) {
    const text = runs.map((run) => run.text).join("")
    for (const piece of pieces) {
      if (piece.end <= start || piece.start >= end) continue
      const span = document.createElement("span")
      apply(span, runs[piece.runIndex], piece.face)
      span.textContent = text.slice(Math.max(start, piece.start), Math.min(end, piece.end))
      parent.append(span)
    }
    return
  }
  let at = 0
  for (const run of runs) {
    if (at + run.text.length > start && at < end) {
      const span = document.createElement("span")
      apply(span, run)
      span.textContent = run.text.slice(Math.max(0, start - at), end - at)
      parent.append(span)
    }
    at += run.text.length
  }
}
function element(lang, width, whiteSpace, controlled = false) {
  const parent = document.createElement("div")
  parent.lang = lang
  Object.assign(parent.style, {
    width: width === null ? "max-content" : width + "px",
    whiteSpace,
    textRendering: "geometricPrecision",
    lineHeight: "72px",
    fontSize: "0",
    fontSynthesis: "none",
    fontOpticalSizing: "none",
    direction: "ltr",
  })
  if (controlled) parent.style.textSpacingTrim = "space-all"
  document.body.append(parent)
  return parent
}

export async function loadNative(manifest) {
  await Promise.all(
    Object.entries(manifest).map(async ([id, meta]) => {
      const face = new FontFace(faceName(id), "url(/faces/" + id + ".ttf)", { weight: meta.weight })
      document.fonts.add(face)
      await face.load()
    }),
  )
  await document.fonts.ready
  return [...document.fonts].map((face) => [face.family, face.status])
}

export function full({ runs, lang }, pieces, id) {
  const parent = element(lang, null, "pre", Boolean(pieces))
  if (id) parent.id = id
  const text = runs.map((run) => run.text).join("")
  paint(parent, runs, 0, text.trimEnd().length, pieces)
  const width = parent.getBoundingClientRect().width
  if (!id) parent.remove()
  return width
}

export function fullLines(item, lines, pieces) {
  return lines.map(({ start, end, softHyphen }) => {
    const parent = element(item.lang, null, "pre", Boolean(pieces))
    const text = item.runs.map((run) => run.text).join("")
    end = start + text.slice(start, end).trimEnd().length
    paint(parent, item.runs, start, end, pieces)
    if (softHyphen && text[end - 1] === "\u00AD") {
      const last = parent.lastChild
      const run = item.runs.at(0)
      const hyphen = run.faces.includes("Emoji") && run.faces[0] === "Emoji" ? "-" : "‐"
      if (last) last.textContent = last.textContent.slice(0, -1) + hyphen
    }
    const width = parent.getBoundingClientRect().width
    parent.remove()
    return width
  })
}

function rangeFor(parent) {
  const nodes = [...parent.querySelectorAll("span")].map((span) => span.firstChild).filter(Boolean)
  const positions = []
  let at = 0
  for (const node of nodes) {
    positions.push({ offset: at, end: at + node.length, node })
    at += node.length
  }
  const range = document.createRange()
  return (start, end) => {
    const from = positions.find((pos) => start < pos.end)
    const to = positions.find((pos) => end <= pos.end)
    if (!from || !to) throw new Error(`Invalid selection [${start}, ${end})`)
    range.setStart(from.node, start - from.offset)
    range.setEnd(to.node, end - to.offset)
    return range.getClientRects()
  }
}

export function wrapped(item, widths) {
  const text = item.runs.map((run) => run.text).join("")
  const clusters = [...new Intl.Segmenter(item.lang, { granularity: "grapheme" }).segment(text)]
  return widths.map((width) => {
    const parent = element(item.lang, width, "pre-wrap")
    paint(parent, item.runs, 0, text.length)
    const rects = rangeFor(parent)
    const parentTop = parent.getBoundingClientRect().top
    const rowOf = (rect) => Math.round((rect.top - parentTop - 16) / 72)
    const rows = []
    for (const { index, segment } of clusters) {
      const end = index + segment.length
      const parts = rects(index, end)
      const followsSoftHyphen = text[index - 1] === "\u00AD"
      const pixel = followsSoftHyphen ? parts[parts.length - 1] : parts[0]
      const last = rows.at(-1)
      const top = pixel ? rowOf(pixel) : (last?.top ?? 0)
      if (!last || top !== last.top || (index > 0 && text[index - 1] === "\n")) rows.push({ top, start: index, end })
      else last.end = end
    }
    if (text.endsWith("\n")) rows.push({ top: rows.at(-1).top + 1, start: text.length, end: text.length })
    for (const row of rows) {
      if (text[row.end - 1] === "\n") row.end--
      const end = row.start + text.slice(row.start, row.end).trimEnd().length
      if (end === row.start) row.width = 0
      else {
        const parts = [...rects(row.start, end)].filter((rect) => rowOf(rect) === row.top)
        row.width = parts.length
          ? Math.max(...parts.map((rect) => rect.right)) - Math.min(...parts.map((rect) => rect.left))
          : 0
      }
      delete row.top
    }
    parent.remove()
    return rows
  })
}

export function pairwiseCanvas({ runs }) {
  const [run] = runs
  const span = document.createElement("span")
  apply(span, run)
  if (run.legacyCanvasFaces) {
    const families = [...run.legacyCanvasFaces.map(faceName), "Inter Variable"]
    span.style.fontFamily = families.map((family) => JSON.stringify(family)).join(",") + ", system-ui, sans-serif"
  }
  const context = document.createElement("canvas").getContext("2d")
  const size = 32
  context.font = `${run.weight} ${size}px ${span.style.fontFamily}`
  context.fontKerning = "normal"
  context.textRendering = "geometricPrecision"
  const measure = (text) => context.measureText(text).width
  const [first, ...rest] = [...run.text]
  let width = measure(first)
  let previous = first
  for (const point of rest) {
    width += measure(previous + point) - measure(previous)
    previous = point
  }
  return (width / size) * run.size
}
