import { readTextValue, writeTextValue, type TextValue } from "@airdesign/document"
import type { Deck } from "@airdesign/engine"
import { readSlides } from "@airdesign/pptx"
import { replaceSelection } from "@airdesign/render"
import {
  commit,
  commitEach,
  heldElements,
  panelChange,
  slideCount,
  slideEdit,
  slidePart,
  slideRoom,
  slideWire,
  textTarget,
  type Held,
  type Parts,
} from "@/corpus-deck"
import { elementCommand, removals } from "@/element-edit"
import { slideBase } from "@/exported-parts"
import { indexedParts } from "@/index-deck"
import { pictureCommand } from "@/picture-add"
import { slideRels } from "@/slide-paint"

export type CorpusEdit = {
  readonly name: string
  readonly run: (parts: Parts, deck: Deck) => Deck
  readonly touches: (parts: Parts) => readonly string[]
}

export const corpusMedia = { sha256: "a".repeat(64), type: "image/png" } as const

const listed = ["ppt/presentation.xml", "ppt/_rels/presentation.xml.rels", "[Content_Types].xml"]
const notesParts = [...listed, "ppt/slides/_rels/", "ppt/notesSlides/"]
const pictureBox = { x: 914_400, y: 914_400, cx: 1_828_800, cy: 1_371_600 }
const many = 50

const targetPart = (parts: Parts) => [textTarget(parts).part]
const partsOf = (rows: readonly Held[]) => [...new Set(rows.map((row) => row.part))]
const typable = (parts: Parts) => heldElements(parts).filter((row) => row.typed !== null)
const movable = (parts: Parts) => heldElements(parts).filter((row) => row.box !== null)
const fillable = (parts: Parts) => heldElements(parts).filter((row) => row.kind === "shape")

function typed(parts: Parts, deck: Deck, change: (text: TextValue) => TextValue): Deck {
  const target = textTarget(parts)
  const text = readTextValue(target.floor)
  if (text === null) throw new Error("text")
  return commit(deck, [{ node: target.node, value: writeTextValue(change(text)), floor: target.floor }])
}

function moved(row: Held, by: number, scale: number) {
  const box = row.box ?? { x: 0, y: 0, cx: 1, cy: 1 }
  const value = { ...box, x: box.x + by, cx: Math.max(1, Math.round(box.cx * scale)) }
  return { node: row.node, property: "box", value, floor: row.floor }
}

function eachPanel(parts: Parts, deck: Deck, rows: readonly Held[], change: Parameters<typeof panelChange>[3]): Deck {
  return rows.reduce((next, row) => panelChange(parts, next, row, change), deck)
}

function addedPicture(parts: Parts, deck: Deck, index: number): Deck {
  const edit = pictureCommand(parts, deck.register, index, { media: corpusMedia }, pictureBox)
  return commit(deck, [slideWire(parts, deck.register, edit)])
}

function notesOn(parts: Parts, deck: Deck, index: number, value: string): Deck {
  const slide = readSlides(slideBase(parts, deck.register))[index]?.slide
  if (slide === undefined) throw new Error("no slide")
  const node = `${slide}.notes`
  const opening = indexedParts(parts).elements.find((each) => each.node === node)?.value
  return commit(deck, [{ node, value, floor: typeof opening === "string" ? opening : "" }])
}

function session(parts: Parts, deck: Deck): Deck {
  const target = textTarget(parts)
  let next = slideEdit(parts, deck, "clone", 0)
  next = slideEdit(parts, next, "add", 1)
  const copy = readSlides(slideBase(parts, next.register))[1]?.slide
  const [, shape] = target.node.split(".")
  if (copy !== undefined && target.part === slidePart(parts, 0)) {
    next = commit(next, [{ node: `${copy}.${shape ?? ""}`, value: target.typed, floor: target.floor }])
  }
  next = addedPicture(parts, next, 2)
  next = notesOn(parts, notesOn(parts, next, 1, "Notes on the copy"), 2, "Notes on the new slide")
  next = commit(next, [moved(target, 254_000, 1)])
  next = panelChange(parts, next, target, { text: { size: 20 } })
  if (slideCount(parts, next) > 4) next = slideEdit(parts, next, "remove", 3)
  return slideEdit(parts, next, "move", 0, 2)
}

export const corpusEdits: readonly CorpusEdit[] = [
  {
    name: "type",
    run: (parts, deck) => typed(parts, deck, (text) => readTextValue(textTarget(parts).typed) ?? text),
    touches: targetPart,
  },
  {
    name: "new-paragraph",
    run: (parts, deck) =>
      typed(parts, deck, (text) => {
        const line = text.length - 1
        const offset = text[line]?.runs.reduce((sum, run) => sum + run.text.length, 0) ?? 0
        const caret = { paragraph: line, offset }
        return replaceSelection(text, caret, caret, ["", "A new line typed in AirDesign"])[0]
      }),
    touches: targetPart,
  },
  { name: "clear-text", run: (parts, deck) => typed(parts, deck, () => [{ from: 0, runs: [] }]), touches: targetPart },
  { name: "move", run: (parts, deck) => commit(deck, [moved(textTarget(parts), 127_000, 1)]), touches: targetPart },
  { name: "resize", run: (parts, deck) => commit(deck, [moved(textTarget(parts), 0, 0.8)]), touches: targetPart },
  {
    name: "recolor",
    run: (parts, deck) => panelChange(parts, deck, textTarget(parts), { fills: { paint: "accent1" } }),
    touches: targetPart,
  },
  {
    name: "font-size",
    run: (parts, deck) => panelChange(parts, deck, textTarget(parts), { text: { size: 28 } }),
    touches: targetPart,
  },
  {
    name: "bold",
    run: (parts, deck) => panelChange(parts, deck, textTarget(parts), { text: { bold: true } }),
    touches: targetPart,
  },
  {
    name: "bullets",
    run: (parts, deck) => panelChange(parts, deck, textTarget(parts), { text: { list: "bullets" } }),
    touches: targetPart,
  },
  {
    name: "align",
    run: (parts, deck) => panelChange(parts, deck, textTarget(parts), { text: { align: "center" } }),
    touches: targetPart,
  },
  {
    name: "type-every-box",
    run: (parts, deck) =>
      commitEach(
        deck,
        typable(parts).map((row) => ({ node: row.node, value: row.typed, floor: row.floor })),
      ),
    touches: (parts) => partsOf(typable(parts)),
  },
  {
    name: "move-every-element",
    run: (parts, deck) =>
      commitEach(
        deck,
        movable(parts).map((row) => moved(row, 63_500, 0.9)),
      ),
    touches: (parts) => partsOf(movable(parts)),
  },
  {
    name: "recolor-every-shape",
    run: (parts, deck) => eachPanel(parts, deck, fillable(parts), { fills: { paint: "accent2" } }),
    touches: (parts) => partsOf(fillable(parts)),
  },
  {
    name: "font-size-every-box",
    run: (parts, deck) => eachPanel(parts, deck, typable(parts), { text: { size: 18 } }),
    touches: (parts) => partsOf(typable(parts)),
  },
  {
    name: "add-text-box",
    run: (parts, deck) => {
      const edit = elementCommand(parts, deck.register, { change: "text", index: 0, size: slideRoom(parts) })
      if (edit?.slide !== "element-add") throw new Error("no text box")
      const value = writeTextValue([{ from: 0, runs: [{ from: 0, text: "A box typed in AirDesign" }] }])
      return commit(commit(deck, [slideWire(parts, deck.register, edit)]), [
        { node: edit.element.node, value, floor: "" },
      ])
    },
    touches: (parts) => [slidePart(parts, 0)],
  },
  {
    name: "add-shape",
    run: (parts, deck) => {
      const room = slideRoom(parts)
      const edit = elementCommand(parts, deck.register, { change: "shape", geometry: "ellipse", index: 0, size: room })
      if (edit?.slide !== "element-add") throw new Error("no shape")
      const added = commit(deck, [slideWire(parts, deck.register, edit)])
      return panelChange(parts, added, { node: edit.element.node, floor: "" }, { fills: { paint: "accent6" } })
    },
    touches: (parts) => [slidePart(parts, 0)],
  },
  {
    name: "text-image",
    run: (parts, deck) =>
      typed(parts, deck, (text) =>
        text.map((paragraph) => ({
          ...paragraph,
          runs: paragraph.runs.map(({ color: _color, ...run }) => ({
            ...run,
            fill: { image: `${corpusMedia.type}:${corpusMedia.sha256}` },
          })),
        })),
      ),
    touches: (parts) => [...targetPart(parts), slideRels(textTarget(parts).part), "[Content_Types].xml"],
  },
  {
    name: "add-picture",
    run: (parts, deck) => addedPicture(parts, deck, 0),
    touches: (parts) => [slidePart(parts, 0), slideRels(slidePart(parts, 0)), "[Content_Types].xml"],
  },
  {
    name: "delete-element",
    run: (parts, deck) => {
      const found = removals(parts, deck.register, [textTarget(parts).node])
      return commit(
        deck,
        found.edits.map((edit) => slideWire(parts, deck.register, edit)),
      )
    },
    touches: targetPart,
  },
  {
    name: "delete-every-element",
    run: (parts, deck) => {
      const found = removals(
        parts,
        deck.register,
        heldElements(parts).map((row) => row.node),
      )
      return commitEach(
        deck,
        found.edits.map((edit) => slideWire(parts, deck.register, edit)),
      )
    },
    touches: (parts) => partsOf(heldElements(parts)),
  },
  {
    name: "notes",
    run: (parts, deck) => notesOn(parts, deck, 0, "Notes typed in AirDesign"),
    touches: () => notesParts,
  },
  {
    name: "notes-every-slide",
    run: (parts, deck) =>
      [...readSlides(parts).keys()].reduce(
        (next, index) => notesOn(parts, next, index, `Notes ${String(index)} typed in AirDesign`),
        deck,
      ),
    touches: () => notesParts,
  },
  { name: "add-slide", run: (parts, deck) => slideEdit(parts, deck, "add", 0), touches: () => listed },
  { name: "duplicate-slide", run: (parts, deck) => slideEdit(parts, deck, "clone", 1), touches: () => listed },
  {
    name: "duplicate-every-slide",
    run: (parts, deck) => {
      let next = deck
      for (let index = slideCount(parts, deck) - 1; index >= 0 && slideCount(parts, next) < many; index -= 1) {
        next = slideEdit(parts, next, "clone", index)
      }
      return next
    },
    touches: () => listed,
  },
  { name: "delete-slide", run: (parts, deck) => slideEdit(parts, deck, "remove", 1), touches: () => listed },
  {
    name: "delete-to-one-slide",
    run: (parts, deck) => {
      let next = deck
      while (slideCount(parts, next) > 1) next = slideEdit(parts, next, "remove", 0)
      return next
    },
    touches: () => listed,
  },
  {
    name: "reorder-slides",
    run: (parts, deck) => slideEdit(parts, deck, "move", 0, slideCount(parts, deck) - 1),
    touches: () => ["ppt/presentation.xml"],
  },
  {
    name: "reverse-slides",
    run: (parts, deck) => {
      const count = slideCount(parts, deck)
      let next = deck
      for (let index = 0; index < count - 1; index += 1) next = slideEdit(parts, next, "move", count - 1, index)
      return next
    },
    touches: () => ["ppt/presentation.xml"],
  },
  {
    name: "session",
    run: session,
    touches: (parts) => [...listed, textTarget(parts).part],
  },
]
