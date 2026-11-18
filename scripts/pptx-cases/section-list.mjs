const heatPumps = "doe-heat-pumps.pptx"
const plain = "nasa-1d-cnn.pptx"
const presentation = "ppt/presentation.xml"
const decoder = new TextDecoder()
const encoder = new TextEncoder()
const partOne = "Part 1: Basic Principles of Heat Pump Operation"
const partTwo = "Part 2: System Design Options/Considerations"
const renamed = "Part 2: Design Options & Choices"

const text = (bytes) => decoder.decode(bytes)

const slidesFirst = (parts, ids) => {
  const xml = text(parts.get(presentation))
  const moved = ids.map((id) => xml.match(new RegExp(`<p:sldId id="${id}"[^>]*/>`))?.[0])
  if (moved.some((element) => element === undefined)) throw new Error("section list case slide")
  const without = moved.reduce((rest, element) => rest.replace(element, ""), xml)
  return new Map(parts).set(
    presentation,
    encoder.encode(without.replace("<p:sldIdLst>", `<p:sldIdLst>${moved.join("")}`)),
  )
}

const outside = (xml) =>
  xml
    .replace(/<p14:sectionLst\b[\s\S]*?<\/p14:sectionLst>/, "")
    .replace('<p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"></p:ext>', "")
    .replace("<p:extLst></p:extLst>", "")

const shown = (pptx, parts) => pptx.readSections(parts).map((section) => `${section.name} ${section.slides.length}`)

export const sectionCases = ({ pptx, parts }) => {
  const deck = parts.get(heatPumps)
  const [intro, one, two, appendices] = pptx.readSections(deck)
  const own = (from) => ({ from, slides: pptx.readSections(deck)[from].slides })
  const head = one.slides.slice(0, 10)
  const tail = one.slides.slice(10)
  const moved = slidesFirst(deck, appendices.slides)
  const split = pptx.writeSections(deck, [
    own(0),
    { from: 1, slides: head },
    { key: "split", slides: tail },
    own(2),
    own(3),
  ])
  const changed = pptx.writeSections(split, [
    own(0),
    { from: 1, slides: head },
    { from: 2, slides: tail },
    { ...own(2), from: 3, name: renamed },
    { ...own(3), from: 4 },
  ])
  const order = pptx.readSlides(parts.get(plain)).map((row) => row.slide)
  const half = Math.ceil(order.length / 2)
  return [
    {
      name: "written-section-split.pptx",
      original: heatPumps,
      base: deck,
      parts: split,
      sections: ["Introduction 1", `${partOne} 10`, "Untitled Section 18", `${partTwo} 10`, "Appendices 2"],
    },
    {
      name: "written-section-merge.pptx",
      original: heatPumps,
      base: deck,
      parts: pptx.writeSections(deck, [{ from: 1, slides: [...intro.slides, ...one.slides] }, own(2), own(3)]),
      sections: [`${partOne} 29`, `${partTwo} 10`, "Appendices 2"],
    },
    {
      name: "written-section-move.pptx",
      original: heatPumps,
      base: moved,
      parts: pptx.writeSections(moved, [own(3), own(0), own(1), own(2)]),
      sections: ["Appendices 2", "Introduction 1", `${partOne} 28`, `${partTwo} 10`],
    },
    {
      name: "written-section-slide.pptx",
      original: heatPumps,
      base: deck,
      parts: pptx.writeSections(deck, [
        own(0),
        { from: 1, slides: one.slides.slice(0, -1) },
        { from: 2, slides: [...one.slides.slice(-1), ...two.slides] },
        own(3),
      ]),
      sections: ["Introduction 1", `${partOne} 27`, `${partTwo} 11`, "Appendices 2"],
    },
    {
      name: "written-section-rename.pptx",
      original: heatPumps,
      base: deck,
      parts: pptx.writeSections(deck, [own(0), own(1), { ...own(2), name: renamed }, own(3)]),
      sections: ["Introduction 1", `${partOne} 28`, `${renamed} 10`, "Appendices 2"],
    },
    {
      name: "written-section-first.pptx",
      original: plain,
      base: parts.get(plain),
      parts: pptx.writeSections(parts.get(plain), [
        { key: "named", name: "Named section", slides: order.slice(0, half) },
        { key: "untitled", slides: order.slice(half) },
      ]),
      sections: [`Named section ${half}`, `Untitled Section ${order.length - half}`],
    },
    {
      name: "written-section-regroup.pptx",
      original: heatPumps,
      base: moved,
      parts: pptx.writeSections(moved, [
        own(3),
        { from: 1, slides: [...intro.slides, ...head] },
        { key: "split", slides: tail },
        own(2),
      ]),
      sections: ["Appendices 2", `${partOne} 11`, "Untitled Section 18", `${partTwo} 10`],
    },
    {
      name: "written-section-back.pptx",
      original: heatPumps,
      base: deck,
      parts: pptx.writeSections(changed, [
        own(0),
        { from: 1, slides: one.slides },
        { ...own(2), from: 3, name: partTwo },
        { ...own(3), from: 4 },
      ]),
      sections: ["Introduction 1", `${partOne} 28`, `${partTwo} 10`, "Appendices 2"],
      same: true,
    },
  ]
}

export default {
  originals: [heatPumps, plain],
  written: [
    "written-section-split.pptx",
    "written-section-merge.pptx",
    "written-section-move.pptx",
    "written-section-slide.pptx",
    "written-section-rename.pptx",
    "written-section-first.pptx",
    "written-section-regroup.pptx",
    "written-section-back.pptx",
  ],
  write: sectionCases,
  lines({ pptx, parts, lists }) {
    return sectionCases({ pptx, parts }).flatMap((row) => {
      const after = parts.get(row.name)
      const before = parts.get(row.original)
      if (after === undefined || before === undefined) return [`${row.name} was not written`]
      const diff = pptx.deckDiff(before, after)
      const lines = [
        ...[...diff.added, ...diff.removed, ...diff.changed.filter((name) => name !== presentation)].map(
          (name) => `${row.name} changed ${name}`,
        ),
        ...pptx.sectionListFailures(after).map((failure) => `${row.name} section list ${failure}`),
        ...pptx
          .newValidatorErrors(lists.get(row.original) ?? [], lists.get(row.name) ?? ["no validator answer"])
          .map((error) => `${row.name} validator ${error}`),
      ]
      if (outside(text(after.get(presentation))) !== outside(text(row.base.get(presentation))))
        lines.push(`${row.name} changed presentation.xml outside the section list`)
      if (JSON.stringify(shown(pptx, after)) !== JSON.stringify(row.sections))
        lines.push(`${row.name} has sections ${JSON.stringify(shown(pptx, after))}`)
      if (row.same === true && diff.changed.length > 0)
        lines.push(`${row.name} is not the original after the change and its reverse`)
      return lines
    })
  },
}
