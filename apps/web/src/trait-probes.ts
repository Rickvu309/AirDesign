import { readArrival, readLayoutGuideList, readShows, readSlideGuides, shownLink } from "@airdesign/pptx"
import {
  changeFills,
  format,
  readTableValue,
  readTextValue,
  writeTableValue,
  type Overlay,
  type Paint,
  type TextValue,
  type TraitName,
} from "@airdesign/document"
import {
  readCells,
  readNotes,
  readTable,
  shownBody,
  shownConnection,
  shownEffects,
  shownFill,
  shownGeometry,
  shownBorder,
  shownTurn,
} from "@airdesign/pptx"
import { element, type At, type Parts, type Probe } from "./parity-probe"
import { layoutProbe } from "./layout-probe"
import { identityProbe, imageProbes } from "./picture-probes"
import { templateStyleProbe } from "./template-style-probe"

const borderOpening = {
  fill: "opening",
  width: "opening",
  dash: "opening",
  cap: "opening",
  compound: "opening",
  join: "opening",
  head: "opening",
  tail: "opening",
} as const

const fillsOpening = {
  p0: "opening",
  p1: "opening",
  p2: "opening",
  p3: "opening",
  source: "opening",
  weight: "opening",
  color: "opening",
  mode: "opening",
  tileScale: "opening",
  crop: "opening",
  recolor: "opening",
  blur: "opening",
} as const

const effectsOpening = {
  shadow: "opening",
  innerShadow: "opening",
  glow: "opening",
  softEdge: "opening",
  blur: "opening",
} as const
const bodyOpening = {
  insets: "opening",
  anchor: "opening",
  wrap: "opening",
  autofit: "opening",
  vertical: "opening",
  columns: "opening",
} as const

function bodyProbe(field: "insets" | "anchor" | "wrap" | "autofit" | "vertical" | "columns") {
  return {
    file: (parts: Parts, at: At) => shownBody(parts, at)?.[field].value,
    shows: (value: unknown) => value,
    inherited: (parts: Parts, at: At) => shownBody(parts, at)?.[field].own === false,
  }
}

const boxOpening = {
  x: "opening",
  y: "opening",
  w: "opening",
  h: "opening",
  rot: "opening",
  flipH: "opening",
  flipV: "opening",
} as const

function words(text: TextValue): string {
  return text.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n")
}

const openingBorder = { width: 12700, fill: { solid: { scheme: "tx1" } } }

function grid(parts: Parts, at: At): readonly (readonly unknown[])[] | undefined {
  const cells = readCells(parts, at.part, at.shape)
  return readTable(parts, at.part, at.shape)?.rows.map((row, line) =>
    row.cells.map((cell, column) => {
      const read = cells[line]?.[column]
      return [words(cell), read?.fill ?? null, read?.borders.bottom ?? null]
    }),
  )
}

function gridShown(value: string): readonly (readonly unknown[])[] | undefined {
  return readTableValue(value)?.rows.map((row) =>
    row.cells.map((cell, column) => [
      words(cell),
      row.fills?.[column] ?? null,
      { ...openingBorder, ...row.borders?.[column]?.bottom },
    ]),
  )
}

export const probes: { readonly [T in TraitName]: Probe<T> } = {
  identity: identityProbe,
  link: {
    painted: (parts, at) => JSON.stringify(shownLink(parts, at)),
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { link: { target: "opening" } } }),
    edit: (_, __, value) => ({ v: format, patch: { link: { target: { set: value } } } }),
    fields: { target: { file: (parts, at) => shownLink(parts, at), shows: (value) => value } },
  },
  show: {
    deck: "blank.pptx",
    kind: "slide",
    node: "256.slide",
    opening: () => ({ v: format, patch: { show: { skipped: "opening" } } }),
    edit: (_, __, value) => ({ v: format, patch: { show: { skipped: { set: value } } } }),
    fields: {
      skipped: {
        file: (parts, at) => readShows(parts).find((show) => show.part === at.part)?.hidden,
        shows: (value) => value,
      },
    },
  },
  transition: {
    deck: "blank.pptx",
    kind: "slide",
    node: "256.slide",
    opening: () => ({ v: format, patch: { transition: { value: "opening" } } }),
    edit: (_, __, value) => ({ v: format, patch: { transition: { value: { set: value } } } }),
    fields: {
      value: {
        file: (parts, at) => {
          const arrival = readArrival(parts.get(at.part))
          return arrival.state === "value" ? arrival.value : null
        },
        shows: (value) => value,
      },
    },
  },
  guides: {
    deck: "census-updating-spm.pptx",
    kind: "slide",
    node: "302.slide",
    opening: () => ({ v: format, patch: { guides: { ruler: "opening", layout: "opening" } } }),
    edit: (_, field, value) => ({ v: format, patch: { guides: { [field]: { set: value } } } }),
    fields: {
      ruler: { file: (parts, at) => readSlideGuides(parts, at.part), shows: (value) => value },
      layout: { file: (parts, at) => readLayoutGuideList(parts, at.part), shows: (value) => value },
    },
  },
  geometry: {
    deck: "shapes-added.pptx",
    kind: "shape",
    node: "256.4",
    opening: () => ({ v: format, patch: { geometry: { shape: "opening" } } }),
    edit: (_, __, value) => ({ v: format, patch: { geometry: { shape: { set: value } } } }),
    fields: { shape: { file: (parts, at) => shownGeometry(parts, at)?.value, shows: (value) => value } },
  },
  fills: {
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { fills: fillsOpening } }),
    edit: (_, field, value) => ({
      v: format,
      patch: {
        fills:
          field === "paint"
            ? changeFills({ paint: value as Paint })
            : field === "overlay"
              ? changeFills({ overlay: value as Overlay })
              : { [field]: { set: value } },
      },
    }),
    fields: {
      paint: {
        file: (parts, at) => shownFill(parts, at)?.value,
        shows: (value) => value,
        inherited: (parts, at) => shownFill(parts, at)?.own === false,
      },
      ...imageProbes,
    },
  },
  border: {
    deck: "census-updating-spm.pptx",
    kind: "connector",
    node: "324.26",
    opening: () => ({ v: format, patch: { border: borderOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { border: { [field]: { set: value } } } }),
    fields: {
      fill: {
        file: (parts, at) => shownBorder(parts, at)?.fill.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.fill.own === false,
      },
      width: {
        file: (parts, at) => shownBorder(parts, at)?.width.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.width.own === false,
      },
      dash: {
        file: (parts, at) => shownBorder(parts, at)?.dash.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.dash.own === false,
      },
      cap: {
        file: (parts, at) => shownBorder(parts, at)?.cap.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.cap.own === false,
      },
      compound: {
        file: (parts, at) => shownBorder(parts, at)?.compound.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.compound.own === false,
      },
      join: {
        file: (parts, at) => shownBorder(parts, at)?.join.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.join.own === false,
      },
      head: {
        file: (parts, at) => shownBorder(parts, at)?.head.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.head.own === false,
      },
      tail: {
        file: (parts, at) => shownBorder(parts, at)?.tail.value,
        shows: (value) => value,
        inherited: (parts, at) => shownBorder(parts, at)?.tail.own === false,
      },
    },
  },
  effects: {
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { effects: effectsOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { effects: { [field]: { set: value } } } }),
    fields: {
      shadow: { file: (parts, at) => shownEffects(parts, at)?.shadow.value, shows: (value) => value },
      innerShadow: { file: (parts, at) => shownEffects(parts, at)?.innerShadow.value, shows: (value) => value },
      glow: { file: (parts, at) => shownEffects(parts, at)?.glow.value, shows: (value) => value },
      softEdge: { file: (parts, at) => shownEffects(parts, at)?.softEdge.value, shows: (value) => value },
      blur: { file: (parts, at) => shownEffects(parts, at)?.blur.value, shows: (value) => value },
    },
  },
  body: {
    deck: "nasa-1d-cnn.pptx",
    kind: "shape",
    node: "467.5",
    opening: () => ({ v: format, patch: { body: bodyOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { body: { [field]: { set: value } } } }),
    fields: {
      insets: bodyProbe("insets"),
      anchor: bodyProbe("anchor"),
      wrap: bodyProbe("wrap"),
      autofit: bodyProbe("autofit"),
      vertical: bodyProbe("vertical"),
      columns: bodyProbe("columns"),
    },
  },
  connection: {
    deck: "census-updating-spm.pptx",
    kind: "connector",
    node: "324.26",
    opening: () => ({ v: format, patch: { connection: { start: "opening", end: "opening" } } }),
    edit: (_, field, value) => ({ v: format, patch: { connection: { [field]: { set: value } } } }),
    fields: {
      start: { file: (parts, at) => shownConnection(parts, at)?.start, shows: (value) => value },
      end: { file: (parts, at) => shownConnection(parts, at)?.end, shows: (value) => value },
    },
  },
  box: {
    deck: "clean.pptx",
    kind: "shape",
    opening: () => ({ v: format, patch: { box: boxOpening } }),
    edit: (_, field, value) => ({ v: format, patch: { box: { [field]: { set: value } } } }),
    fields: {
      x: { file: (parts, at) => element(parts, at)?.box?.x, shows: (value) => value },
      y: { file: (parts, at) => element(parts, at)?.box?.y, shows: (value) => value },
      w: { file: (parts, at) => element(parts, at)?.box?.cx, shows: (value) => value },
      h: { file: (parts, at) => element(parts, at)?.box?.cy, shows: (value) => value },
      rot: { file: (parts, at) => shownTurn(parts, at).rot, shows: (value) => value },
      flipH: { file: (parts, at) => shownTurn(parts, at).flipH, shows: (value) => value },
      flipV: { file: (parts, at) => shownTurn(parts, at).flipV, shows: (value) => value },
    },
  },
  text: {
    deck: "clean.pptx",
    kind: "shape",
    opening: (parts, at) => ({ value: element(parts, at)?.value ?? "" }),
    edit: (_, __, value) => ({ value }),
    fields: {
      value: {
        file: (parts, at) => words(readTextValue(element(parts, at)?.value ?? "") ?? []),
        shows: (value) => words(readTextValue(value) ?? [{ from: 0, runs: [{ from: 0, text: value }] }]),
      },
    },
  },
  notes: {
    deck: "nasa-1d-cnn.pptx",
    kind: "slide",
    opening: (parts, at) => ({ value: readNotes(parts).find((notes) => notes.slide === at.slide)?.text ?? "" }),
    edit: (_, __, value) => ({ value }),
    fields: {
      value: {
        file: (parts, at) => readNotes(parts).find((notes) => notes.slide === at.slide)?.text,
        shows: (value) => value,
      },
    },
  },
  layout: layoutProbe,
  table: {
    deck: "table-added.pptx",
    kind: "table",
    opening: (parts, at) => {
      const table = readTable(parts, at.part, at.shape)
      return { value: table === null ? "" : writeTableValue(table) }
    },
    edit: (_, __, value) => ({ value }),
    fields: {
      value: { file: grid, shows: gridShown },
    },
  },
  templateStyle: templateStyleProbe,
}
