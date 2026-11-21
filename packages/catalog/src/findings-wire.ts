import { limits, readElementId, type ElementId } from "@airdesign/document"
import { readSlidePictures, type SlidePictures } from "./slide-pictures-wire.js"
import { fieldRefusal, knownKeys, readDeckId, recordOf, type DeckId, type FieldRefusal } from "./wire.js"

export type WireFinding = { readonly node: ElementId } & (
  | {
      readonly code: "overflow"
      readonly needed: number
      readonly room: number
      readonly size: number | null
      readonly height: number
    }
  | {
      readonly code: "off-slide"
      readonly past: number
      readonly whole: boolean
      readonly x: number | null
      readonly y: number | null
    }
  | {
      readonly code: "overlap"
      readonly other: ElementId
      readonly by: "cover" | "text"
      readonly x: number
      readonly y: number
    }
  | {
      readonly code: "misaligned"
      readonly other: ElementId
      readonly edge: (typeof alignEdges)[number]
      readonly by: number
      readonly x: number | null
      readonly y: number | null
    }
  | { readonly code: "small-text"; readonly size: number; readonly min: number; readonly uniform: boolean }
  | { readonly code: "low-contrast"; readonly ratio: number; readonly needs: number; readonly color: string | null }
  | { readonly code: "empty-placeholder"; readonly placeholder: string }
)

export type FindingsReport = {
  readonly deck: DeckId
  readonly revision: number
  readonly findings: readonly WireFinding[]
  readonly broken?: true
  readonly pictures?: SlidePictures
}

type Body = Readonly<Record<string, unknown>>

const alignEdges = ["left", "right", "top", "bottom"] as const
const pointsCeiling = 100_000
const sizeCeiling = 4_000
const hexColor = /^[0-9A-F]{6}$/
const placeholderName = /^[A-Za-z]{1,32}$/
const findingsCeiling = limits.elements * 4

function pointsOf(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= pointsCeiling ? raw : undefined
}

function placeOf(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && Math.abs(raw) <= pointsCeiling ? raw : undefined
}

function sizeOf(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= sizeCeiling ? raw : undefined
}

function ratioOf(raw: unknown): number | undefined {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 1 && raw <= 21 ? raw : undefined
}

function nodeOf(raw: unknown): ElementId | undefined {
  return typeof raw === "string" ? readElementId(raw) : undefined
}

function defined<T extends Body>(read: T): T | undefined {
  return Object.values(read).every((value) => value !== undefined) ? read : undefined
}

const readers: Readonly<Record<WireFinding["code"], readonly [readonly string[], (body: Body) => Body | undefined]>> = {
  overflow: [
    ["needed", "room", "size", "height"],
    (body) =>
      defined({
        needed: pointsOf(body.needed),
        room: pointsOf(body.room),
        size: body.size === null ? null : sizeOf(body.size),
        height: pointsOf(body.height),
      }),
  ],
  "off-slide": [
    ["past", "whole", "x", "y"],
    (body) => {
      const spot =
        body.x === null && body.y === null ? { x: null, y: null } : defined({ x: placeOf(body.x), y: placeOf(body.y) })
      const whole = typeof body.whole === "boolean" ? body.whole : undefined
      return spot === undefined ? undefined : defined({ past: pointsOf(body.past), whole, ...spot })
    },
  ],
  overlap: [
    ["other", "by", "x", "y"],
    (body) =>
      defined({
        other: nodeOf(body.other),
        by: body.by === "cover" || body.by === "text" ? body.by : undefined,
        x: placeOf(body.x),
        y: placeOf(body.y),
      }),
  ],
  misaligned: [
    ["other", "edge", "by", "x", "y"],
    (body) => {
      const x = body.x === null ? null : placeOf(body.x)
      const y = body.y === null ? null : placeOf(body.y)
      if ((x === null) === (y === null)) return undefined
      const edge = alignEdges.find((each) => each === body.edge)
      return defined({ other: nodeOf(body.other), edge, by: pointsOf(body.by), x, y })
    },
  ],
  "small-text": [
    ["size", "min", "uniform"],
    (body) =>
      defined({
        size: pointsOf(body.size),
        min: sizeOf(body.min),
        uniform: typeof body.uniform === "boolean" ? body.uniform : undefined,
      }),
  ],
  "low-contrast": [
    ["ratio", "needs", "color"],
    (body) =>
      defined({
        ratio: ratioOf(body.ratio),
        needs: ratioOf(body.needs),
        color:
          body.color === null
            ? null
            : typeof body.color === "string" && hexColor.test(body.color)
              ? body.color
              : undefined,
      }),
  ],
  "empty-placeholder": [
    ["placeholder"],
    (body) =>
      defined({
        placeholder:
          typeof body.placeholder === "string" && placeholderName.test(body.placeholder) ? body.placeholder : undefined,
      }),
  ],
}

function readFinding(raw: unknown): WireFinding | undefined {
  const body = recordOf(raw)
  const code = body?.code
  if (body === undefined || typeof code !== "string" || !Object.hasOwn(readers, code)) return undefined
  const [fields, read] = readers[code as WireFinding["code"]]
  if (!knownKeys(body, ["code", "node", ...fields]) || !fields.every((field) => Object.hasOwn(body, field)))
    return undefined
  const node = nodeOf(body.node)
  const rest = read(body)
  return node === undefined || rest === undefined ? undefined : ({ code, node, ...rest } as WireFinding)
}

export function readFindingsReport(
  raw: unknown,
): ({ readonly ok: true } & FindingsReport) | FieldRefusal | Exclude<ReturnType<typeof readDeckId>, { ok: true }> {
  const body = recordOf(raw)
  if (body === undefined || !knownKeys(body, ["deck", "revision", "findings", "broken", "pictures"]))
    return fieldRefusal
  if (!Object.hasOwn(body, "deck") || !Array.isArray(body.findings)) return fieldRefusal
  const deck = readDeckId(body.deck)
  if (!deck.ok) return deck
  const { revision } = body
  if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return fieldRefusal
  const rows: unknown[] = body.findings
  if (Object.hasOwn(body, "broken") && (body.broken !== true || rows.length > 0)) return fieldRefusal
  if (rows.length > findingsCeiling) return fieldRefusal
  const findings: WireFinding[] = []
  for (const row of rows) {
    const read = readFinding(row)
    if (read === undefined) return fieldRefusal
    findings.push(read)
  }
  const report = {
    ok: true as const,
    deck: deck.deck,
    revision,
    findings,
    ...(body.broken === true ? { broken: true as const } : {}),
  }
  if (!Object.hasOwn(body, "pictures")) return report
  const pictures = readSlidePictures(body.pictures)
  return pictures === undefined ? fieldRefusal : { ...report, pictures }
}
