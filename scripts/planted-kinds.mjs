const letters = "abcdefghijklmnopqrstuvwxyz"

export class NoPlace extends Error {}

const place = (found) => {
  if (found === undefined) throw new NoPlace()
  return found
}

const decoder = new TextDecoder("utf-8", { ignoreBOM: true })
const encoder = new TextEncoder()
const read = (parts, name) => decoder.decode(place(parts.get(name)))
const write = (parts, name, xml) => new Map(parts).set(name, encoder.encode(xml))
const insertAt = (xml, at, inserted) => xml.slice(0, at) + inserted + xml.slice(at)
const cut = (xml, start, end) => xml.slice(0, start) + xml.slice(end)

const contentTypes = "[Content_Types].xml"
const presentation = "ppt/presentation.xml"
const emptyLabelExtension = /<c:ext uri="\{CE6537A1-D6FC-4f65-9D91-7224C49458BB\}"[^>]*\/>/g
const slideNames = (parts) => [...parts.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
const slideRelationships = (parts) =>
  [...parts.keys()].filter((name) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name))
const chartNames = (parts) => [...parts.keys()].filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name))
const relationships = (xml) => [...xml.matchAll(/<Relationship [^>]*\/>/g)]
const relationshipId = (relationship) => place(/ Id="([^"]*)"/.exec(relationship)?.[1])

const unusedRelationshipId = (random, xml) => {
  for (;;) {
    const id = `rId${random.between(1000, 1000000)}`
    if (!xml.includes(`"${id}"`)) return id
  }
}

const closesEntity = (text, offset) => {
  const opened = text.lastIndexOf("&", offset - 1)
  if (opened < 0) return true
  const closed = text.indexOf(";", opened)
  return closed >= 0 && closed < offset
}

const splitsPair = (text, offset) => {
  const code = text.charCodeAt(offset)
  return offset > 0 && code >= 0xdc00 && code <= 0xdfff
}

const insertIntoText = (parts, random, inserted, described) => {
  const slide = place(random.pick(slideNames(parts)))
  const xml = read(parts, slide)
  const texts = [...xml.matchAll(/<a:t>([^<]+)<\/a:t>/g)]
  const text = place(random.pick(texts))
  const offsets = Array.from({ length: text[1].length + 1 }, (_, offset) => offset).filter(
    (offset) => closesEntity(text[1], offset) && !splitsPair(text[1], offset),
  )
  const offset = place(random.pick(offsets))
  return {
    parts: write(parts, slide, insertAt(xml, text.index + "<a:t>".length + offset, inserted)),
    what: `${slide} text ${texts.indexOf(text) + 1} of ${texts.length}, offset ${offset}, ${described}`,
  }
}

const controlCodes = [
  1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31,
]

const ownedKinds = ["notesSlide", "chart", "diagramData", "diagramLayout", "diagramQuickStyle", "diagramColors"]

const ownedLinks = (parts) =>
  slideRelationships(parts).flatMap((name) =>
    relationships(read(parts, name)).flatMap((found) => {
      const kind = / Type="[^"]*\/([^"/]+)"/.exec(found[0])?.[1]
      const target = / Target="([^"]*)"/.exec(found[0])
      if (kind === undefined || !ownedKinds.includes(kind) || target === null) return []
      return [{ name, kind, at: found.index + target.index + ' Target="'.length, target: target[1] }]
    }),
  )

const single = (pptx, parts) => {
  const slides = new Set(slideNames(parts))
  return pptx.shapeIdCounts(parts).filter((row) => slides.has(row.part) && row.count === 1)
}

export const breakKinds = {
  "dangling relationship": (pptx, parts, random) => {
    const name = place(random.pick(slideRelationships(parts)))
    const xml = read(parts, name)
    const id = unusedRelationshipId(random, xml)
    const target = `../media/${random.word()}.${random.pick(["png", "jpeg", "gif"])}`
    const added = `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`
    return {
      parts: write(parts, name, insertAt(xml, xml.lastIndexOf("</Relationships>"), added)),
      what: `${name} ${id} to ${target}`,
    }
  },
  "wrong child order": (pptx, parts, random) => {
    for (const slide of random.shuffled(slideNames(parts))) {
      const xml = read(parts, slide)
      const shapes = []
      for (const opened of xml.matchAll(/<p:sp[ >]/g)) {
        const shape = xml.slice(opened.index, xml.indexOf("</p:sp>", opened.index))
        const properties = shape.indexOf("<p:spPr")
        const body = shape.indexOf("<p:txBody>")
        const bodyEnd = shape.indexOf("</p:txBody>") + "</p:txBody>".length
        if (properties < 0 || body < properties || bodyEnd < body) continue
        shapes.push({ start: opened.index, properties, body, bodyEnd })
      }
      if (shapes.length === 0) continue
      const shape = random.pick(shapes)
      const moved = xml.slice(shape.start + shape.body, shape.start + shape.bodyEnd)
      const without = cut(xml, shape.start + shape.body, shape.start + shape.bodyEnd)
      return {
        parts: write(parts, slide, insertAt(without, shape.start + shape.properties, moved)),
        what: `${slide} shape ${shapes.indexOf(shape) + 1} of ${shapes.length}`,
      }
    }
    throw new NoPlace()
  },
  "slide content type removed": (pptx, parts, random) => {
    const slide = place(random.pick(slideNames(parts)))
    const xml = read(parts, contentTypes)
    const start = xml.indexOf(`<Override PartName="/${slide}"`)
    if (start < 0) throw new NoPlace()
    return {
      parts: write(parts, contentTypes, cut(xml, start, xml.indexOf("/>", start) + "/>".length)),
      what: slide,
    }
  },
  "duplicate shape id": (pptx, parts, random) => {
    const rows = single(pptx, parts)
    for (const changed of random.shuffled(rows)) {
      const copied = random.pick(rows.filter((row) => row.part === changed.part && row.id !== changed.id))
      const xml = read(parts, changed.part)
      const at = xml.indexOf(`<p:cNvPr id="${changed.id}"`)
      if (copied === undefined || at < 0) continue
      const idStart = at + '<p:cNvPr id="'.length
      return {
        parts: write(parts, changed.part, insertAt(cut(xml, idStart, idStart + changed.id.length), idStart, copied.id)),
        what: `${changed.part} id ${changed.id} becomes ${copied.id}`,
      }
    }
    throw new NoPlace()
  },
  "chart data-label range": (pptx, parts, random) => {
    for (const chart of random.shuffled(chartNames(parts))) {
      const xml = read(parts, chart)
      const extensions = [...xml.matchAll(emptyLabelExtension)]
      if (extensions.length === 0) continue
      const extension = random.pick(extensions)
      const column = `${random.pick(letters)}${random.pick(letters)}`.toUpperCase()
      const first = random.between(1000, 900000)
      const range = `Sheet1!$${column}$${first}:$${column}$${first + random.between(1, 500)}`
      const filled = `${extension[0].slice(0, -"/>".length)}><c15:datalabelsRange><c15:f>${range}</c15:f></c15:datalabelsRange></c:ext>`
      return {
        parts: write(
          parts,
          chart,
          insertAt(cut(xml, extension.index, extension.index + extension[0].length), extension.index, filled),
        ),
        what: `${chart} label ${extensions.indexOf(extension) + 1} of ${extensions.length}, ${range}`,
      }
    }
    throw new NoPlace()
  },
  "control character in text": (pptx, parts, random) => {
    const code = random.pick(controlCodes)
    return insertIntoText(parts, random, String.fromCharCode(code), `code ${code}`)
  },
  "unescaped ampersand in text": (pptx, parts, random) => {
    const inserted = `${random.word()} & ${random.word()}`
    return insertIntoText(parts, random, inserted, inserted)
  },
  "slide id without relationship": (pptx, parts, random) => {
    const xml = read(parts, presentation)
    const listed = [...xml.matchAll(/<p:sldId [^>]*\/>/g)]
    const after = place(random.pick(listed))
    const relationshipsXml = read(parts, "ppt/_rels/presentation.xml.rels")
    const relationship = unusedRelationshipId(random, relationshipsXml + xml)
    for (;;) {
      const id = random.between(256, 2147483647)
      if (xml.includes(`id="${id}"`)) continue
      return {
        parts: write(
          parts,
          presentation,
          insertAt(xml, after.index + after[0].length, `<p:sldId id="${id}" r:id="${relationship}"/>`),
        ),
        what: `slide id ${id} with ${relationship} after entry ${listed.indexOf(after) + 1} of ${listed.length}`,
      }
    }
  },
  "relationship id used twice": (pptx, parts, random) => {
    const name = place(random.pick(slideRelationships(parts)))
    const xml = read(parts, name)
    const listed = relationships(xml)
    const copied = place(random.pick(listed))[0]
    const id = relationshipId(place(random.pick(listed))[0])
    const added = copied.replace(` Id="${relationshipId(copied)}"`, ` Id="${id}"`)
    return {
      parts: write(parts, name, insertAt(xml, xml.lastIndexOf("</Relationships>"), added)),
      what: `${name} ${id} again`,
    }
  },
  "owned part shared": (pptx, parts, random) => {
    const links = ownedLinks(parts)
    for (const taken of random.shuffled(links)) {
      const others = links.filter((link) => link.kind === taken.kind && link.name !== taken.name)
      if (others.length === 0) continue
      const other = random.pick(others)
      const xml = read(parts, other.name)
      return {
        parts: write(
          parts,
          other.name,
          insertAt(cut(xml, other.at, other.at + other.target.length), other.at, taken.target),
        ),
        what: `${other.name} ${other.kind} to ${taken.target}`,
      }
    }
    throw new NoPlace()
  },
  "image content type removed": (pptx, parts, random) => {
    const xml = read(parts, contentTypes)
    const used = new Set(
      [...parts.keys()]
        .filter((name) => name.startsWith("ppt/media/"))
        .map((name) => name.slice(name.lastIndexOf(".") + 1)),
    )
    const defaults = [...xml.matchAll(/<Default Extension="([^"]*)"[^>]*\/>/g)].filter((each) => used.has(each[1]))
    const removed = place(random.pick(defaults))
    return {
      parts: write(parts, contentTypes, cut(xml, removed.index, removed.index + removed[0].length)),
      what: `extension ${removed[1]}`,
    }
  },
}

const routed = (route, describe) => (pptx, parts, random) => {
  for (const row of random.shuffled(single(pptx, parts))) {
    try {
      const asked = { ...route(random, pptx, parts, row), part: row.part, shape: row.id }
      const next = pptx.applyRoute(parts, asked)
      if (next.get(row.part) === parts.get(row.part)) continue
      return { parts: next, what: `${row.part} shape ${row.id}, ${describe(asked)}` }
    } catch {
      continue
    }
  }
  throw new NoPlace()
}

const emu = (random) => random.between(0, 9000000)
const extent = (random) => random.between(100000, 5000000)
const words = (random) => `${random.word()} ${random.word()} ${random.between(1, 1000)}`

export const benignKinds = {
  "text replaced": routed(
    (random, pptx, parts, row) => ({
      name: "text",
      value: pptx.oneRunValue(parts, row.part, row.id, words(random)),
    }),
    (asked) => asked.value[0].runs[0].text,
  ),
  "shape moved": routed(
    (random) => ({ name: "move", x: emu(random), y: emu(random) }),
    (asked) => `to ${asked.x} ${asked.y}`,
  ),
  "shape resized": routed(
    (random) => ({ name: "resize", cx: extent(random), cy: extent(random) }),
    (asked) => `to ${asked.cx} ${asked.cy}`,
  ),
  "text shape added": (pptx, parts, random) => {
    const part = place(random.pick(slideNames(parts)))
    const asked = {
      name: "add",
      part,
      text: words(random),
      x: emu(random),
      y: emu(random),
      cx: extent(random),
      cy: extent(random),
    }
    return {
      parts: pptx.applyRoute(parts, asked),
      what: `${part} ${asked.text} at ${asked.x} ${asked.y} size ${asked.cx} ${asked.cy}`,
    }
  },
  "shape renamed": (pptx, parts, random) => {
    for (const slide of random.shuffled(slideNames(parts))) {
      const xml = read(parts, slide)
      const named = [...xml.matchAll(/<p:cNvPr id="(\d+)" name="[^"]*"/g)]
      if (named.length === 0) continue
      const renamed = random.pick(named)
      const name = `${random.word()} ${random.between(1, 100)}`
      const next = `<p:cNvPr id="${renamed[1]}" name="${name}"`
      return {
        parts: write(
          parts,
          slide,
          insertAt(cut(xml, renamed.index, renamed.index + renamed[0].length), renamed.index, next),
        ),
        what: `${slide} shape ${renamed[1]} named ${name}`,
      }
    }
    throw new NoPlace()
  },
}
