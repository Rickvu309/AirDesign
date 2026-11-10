const letters = "abcdefghijklmnopqrstuvwxyz"

export const seededRandom = (seed) => {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), state | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
  const below = (count) => Math.floor(next() * count)
  const between = (low, high) => low + below(high - low)
  const pick = (list) => list[below(list.length)]
  const shuffled = (list) => {
    const order = [...list]
    for (let last = order.length - 1; last > 0; last -= 1) {
      const other = below(last + 1)
      const kept = order[last]
      order[last] = order[other]
      order[other] = kept
    }
    return order
  }
  const word = () => Array.from({ length: between(5, 11) }, () => letters[below(letters.length)]).join("")
  return { next, below, between, pick, shuffled, word }
}

const wholeSeed = (seed) => Number.isInteger(seed) && seed >= 0 && seed <= 4294967295

export const seedFrom = (chosen) => {
  if (chosen === undefined || chosen === "") return { mode: "list" }
  if (chosen === "random") return { mode: "random" }
  const seed = Number(chosen)
  if (!wholeSeed(seed)) {
    throw new Error(`JUDGE_SEED must be a whole number from 0 to 4294967295, or random, and it is ${chosen}.`)
  }
  return { mode: "one", seed }
}

export const sampleSeed = (seed, kind, sample) => {
  let hash = 2166136261
  for (const char of `${seed} ${kind} ${sample}`) {
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0
  }
  return hash
}

export const replay = (seed) => `seed ${seed}, replay with JUDGE_SEED=${seed} pnpm check:pptx`

const knownRow = (row) =>
  wholeSeed(row?.seed) && typeof row.kind === "string" && typeof row.deck === "string" && typeof row.what === "string"

export const readSeedList = (text) => {
  const parsed = JSON.parse(text)
  if (!Array.isArray(parsed.seeds) || parsed.seeds.length === 0 || parsed.seeds.some((seed) => !wholeSeed(seed))) {
    throw new Error("The seed list needs at least one whole-number seed.")
  }
  if (!Array.isArray(parsed.known) || parsed.known.some((row) => !knownRow(row))) {
    throw new Error("The seed list needs known failures with a seed, kind, deck and what.")
  }
  return { seeds: parsed.seeds, known: parsed.known }
}

export const seedsFor = ({ chosen, list, draw }) => {
  const choice = seedFrom(chosen)
  if (choice.mode === "list") {
    return { seeds: list.seeds, known: list.known, chosen: false, announce: list.seeds.map((seed) => replay(seed)) }
  }
  if (choice.mode === "random") {
    const seed = draw() >>> 0
    return { seeds: [seed], known: [], chosen: true, announce: [`random ${replay(seed)}`] }
  }
  return {
    seeds: [choice.seed],
    known: list.known.filter((row) => row.seed === choice.seed),
    chosen: true,
    announce: [replay(choice.seed)],
  }
}

class NoPlace extends Error {}

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
    const asked = { ...route(random), part: row.part, shape: row.id }
    try {
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
    (random) => ({ name: "text", text: words(random) }),
    (asked) => asked.text,
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

export const untouchedDeck = "untouched deck"

const plantOne = ({ pptx, order, seed, kind, mutate, sample }) => {
  for (let turn = 0; turn < order.length; turn += 1) {
    const deck = order[(sample + turn) % order.length]
    try {
      return { deck: deck.name, ...mutate(pptx, deck.parts, seededRandom(sampleSeed(seed, kind, sample))) }
    } catch (error) {
      if (!(error instanceof NoPlace)) throw error
    }
  }
  throw new Error(`No deck has a place for ${kind}.`)
}

export const plantSamples = ({ pptx, decks, seed, samples }) => {
  const planted = []
  for (const [benign, kinds] of [
    [false, breakKinds],
    [true, benignKinds],
  ]) {
    for (const [kind, mutate] of Object.entries(kinds)) {
      const order = seededRandom(sampleSeed(seed, kind, "decks")).shuffled(decks)
      for (let sample = 0; sample < samples; sample += 1) {
        planted.push({ kind, benign, sample, ...plantOne({ pptx, order, seed, kind, mutate, sample }) })
      }
    }
  }
  decks.forEach((deck, sample) => {
    planted.push({ kind: untouchedDeck, benign: true, sample, deck: deck.name, parts: deck.parts, what: "rewritten" })
  })
  return planted
}

export const kindVerdicts = (judged) => {
  const verdicts = {}
  for (const sample of judged) {
    if (sample.benign) continue
    verdicts[sample.kind] = sample.accepted || verdicts[sample.kind] === "missed" ? "missed" : "caught"
  }
  return verdicts
}

export const caughtCount = (recorded) => ({
  now: Object.values(recorded).filter((verdict) => verdict === "caught").length,
  goal: Object.keys(recorded).length,
})

const sampleLine = (sample) => `${sample.deck}, ${sample.what}`

const samePlace = (sample, row) => row.kind === sample.kind && row.deck === sample.deck && row.what === sample.what

export const proofFailures = ({ recorded, judged, seed, known = [], chosen = false }) => {
  const lines = []
  const measured = kindVerdicts(judged)
  const again = replay(seed)
  const listed = known.filter((row) => row.seed === seed)
  const missedNote = chosen ? `Fix the cause, then add the seed to the list. ${again}` : again
  for (const [kind, verdict] of Object.entries(measured)) {
    const record = recorded[kind]
    if (record !== "caught" && record !== "missed") {
      lines.push(`${kind} is ${verdict} and judge-proof.json does not record it. Record ${verdict} there. ${again}`)
      continue
    }
    if (record === "caught" && verdict === "missed") {
      for (const sample of judged.filter((each) => each.kind === kind && each.accepted)) {
        if (listed.some((row) => samePlace(sample, row))) continue
        lines.push(`The judge missed ${kind}, recorded caught: ${sampleLine(sample)}. ${missedNote}`)
      }
    }
    if (record === "missed" && verdict === "caught") {
      lines.push(
        `The judge now catches ${kind} and judge-proof.json says missed. Record caught there and in metrics.json. ${again}`,
      )
    }
  }
  for (const kind of Object.keys(recorded)) {
    if (!(kind in measured)) lines.push(`${kind} is in judge-proof.json and no mutator plants it.`)
  }
  for (const sample of judged) {
    if (!sample.benign || sample.accepted) continue
    lines.push(
      `The judge rejected ${sample.kind}, an edit that leaves the file valid: ${sampleLine(sample)}: ${sample.reason}. ${again}`,
    )
  }
  for (const row of listed) {
    if (judged.some((sample) => sample.accepted && samePlace(sample, row))) continue
    lines.push(
      `The judge caught ${row.kind}, and the seed list still names this miss: ${sampleLine(row)}. Delete that entry. ${again}`,
    )
  }
  return lines
}

export const proofTable = (judged) => {
  const kinds = [...new Set(judged.map((sample) => sample.kind))]
  const width = Math.max(...kinds.map((kind) => kind.length))
  const measured = kindVerdicts(judged)
  return kinds.map((kind) => {
    const samples = judged.filter((sample) => sample.kind === kind)
    const benign = samples[0].benign
    const agreed = samples.filter((sample) => sample.accepted === benign).length
    const verdict = benign ? (agreed === samples.length ? "accepted" : "rejected") : measured[kind]
    const counted = benign ? "accepted" : "caught"
    return `judge ${benign ? "valid" : "break"}  ${kind.padEnd(width)}  ${verdict.padEnd(8)}  ${agreed} of ${samples.length} samples ${counted}`
  })
}
