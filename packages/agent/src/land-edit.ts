import { fallbackFont, servedFontName } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { hostRefused, refused, type Answer } from "./answer.js"
import { worded } from "./problem-words.js"
import { type Problems, layoutOf } from "./problems-answer.js"
import type { DeckHost, Opened } from "./deck-host.js"
import { deckMeasure } from "./deck-measure.js"
import { onceIds } from "./once-ids.js"

function rootsInFold(fold: doom.Doom, client: string): readonly doom.NodeId[] {
  const mine = [...fold.nodes.values()].filter((node) => node.id.startsWith(`${client}:`) && node.type !== "slideRow")
  const made = new Set<string>(mine.map((node) => node.id))
  return mine.filter((node) => !made.has(doom.parentOf(node)?.id ?? "")).map((node) => node.id)
}

export type Landed = {
  readonly landed: true
  readonly rev: number
  readonly problems: Problems
  readonly bakedLayouts: readonly doom.NodeId[]
  readonly unchanged?: true
}

export type LandedBefore = { readonly rev: number; readonly problems: Problems }

export async function landedBefore(opened: Opened, once: string, host: DeckHost): Promise<LandedBefore | undefined> {
  const rev = opened.fold.onces.get(once)
  if (rev === undefined) return undefined
  const roots = rootsInFold(opened.fold, onceIds(once).client)
  const touched = () =>
    doom.touchedSlides(
      opened.fold,
      opened.fold,
      roots.map((node) => ({ node, prop: "type" as const })),
    )
  return { rev, problems: await layoutOf(host, opened.fold, touched) }
}

export type Agent = { readonly id: string; readonly name?: string | undefined }

const shapingScripts = [
  "Arabic",
  "Syriac",
  "Thaana",
  "Nko",
  "Mongolian",
  "Phags_Pa",
  "Mandaic",
  "Manichaean",
  "Psalter_Pahlavi",
  "Adlam",
  "Hanifi_Rohingya",
  "Sogdian",
  "Old_Uyghur",
  "Devanagari",
  "Bengali",
  "Gurmukhi",
  "Gujarati",
  "Oriya",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Sinhala",
  "Myanmar",
  "Balinese",
  "Javanese",
  "Sundanese",
  "Khmer",
  "Tibetan",
  "Thai",
  "Lao",
  "Hangul",
].map((script) => ({
  pattern: new RegExp(`\\p{Script=${script}}`, "u"),
  name: `${script.replaceAll("_", " ")} text`,
}))

const shapingPatterns = [
  {
    pattern:
      /[\u20e3\ufe0f\p{Regional_Indicator}\p{Emoji_Modifier}\u{e0020}-\u{e007f}]|\p{Emoji}\u200d|\u200d\p{Emoji}/u,
    name: "a color emoji sequence",
  },
  ...shapingScripts,
]

function shapingIn(text: doom.Text): readonly string[] {
  const { chars } = text
  const selected = chars.includes("\ufe0e")
    ? [...doom.graphemes(chars)].flatMap(({ segment }) =>
        segment.includes("\ufe0e") ? [segment === "\ufe0e" ? "U+FE0E" : `“${segment}”`] : [],
      )
    : []
  const found = [...selected, ...shapingPatterns.filter(({ pattern }) => pattern.test(chars)).map(({ name }) => name)]
  if (found.length === 0 && /[\u200c\u200d]/u.test(chars)) return ["a character that changes how letters join"]
  return found
}

function bakeRefusal(
  bake: { readonly fold: doom.Doom; readonly frame: doom.NodeId },
  layers: readonly doom.NodeId[],
  issue:
    | { readonly reason: "pending" }
    | { readonly reason: "coverage"; readonly characters: string }
    | { readonly reason: "shaping"; readonly shaping: readonly string[] },
): Answer {
  const layerNames = layers.map((layer) => doom.propOf(bake.fold.nodes.get(layer), "name") ?? "")
  const named = layerNames.every((name) => name !== "")
    ? new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(layerNames.map((name) => `“${name}”`))
    : layers.length === 1
      ? "1 text layer"
      : `${layers.length} text layers`
  const list = new Intl.ListFormat("en")
  const why = {
    pending: `Fonts for ${named} are unavailable. Resend the batch when the fonts load, switch to an available served font, or resend the other changes with auto layout still on.`,
    shaping:
      issue.reason === "shaping"
        ? `Unable to measure ${list.format(issue.shaping)} in ${named}. Keep the frame in auto layout when resending the other changes.`
        : "",
    coverage: `The current fonts are missing letters or symbols in ${named}. Choose a served font that covers the text and resend the batch, or resend the other changes with auto layout still on.`,
  }
  return refused("fonts", {
    ...issue,
    target: bake.frame,
    layers,
    layerNames,
    note: `None of the changes in this batch were applied. ${why[issue.reason]}`,
  })
}

const estimate = doom.measureWith({})

export async function measuredSteps<Done>(
  steps: Generator<doom.Bake, Done, doom.Measure>,
  host: DeckHost,
  pendingFonts: ReadonlySet<string>,
): Promise<Done | Answer> {
  let step = steps.next()
  while (!step.done) {
    const bake = step.value
    const { required, measured: context } = doom.bakeTextLayers(bake.fold, bake.frame)
    if (context.length === 0) {
      step = steps.next(estimate)
      continue
    }
    const theme = doom.deckOf(bake.fold).theme
    const withPendingFace = (faces: ReadonlySet<string> | undefined) =>
      required.filter((layer) => {
        const text = doom.propOf(bake.fold.nodes.get(layer), "text")
        return text !== undefined && [...doom.charsByFace(text, theme).keys()].some((face) => faces?.has(face))
      })
    if (pendingFonts.size > 0) {
      const waiting = new Set(
        doom.doomFaces(bake.fold, required).faces.flatMap((face) => {
          const primary = servedFontName(face.font) ?? fallbackFont
          return pendingFonts.has(primary.toLowerCase()) || pendingFonts.has(fallbackFont.toLowerCase())
            ? [doom.fontFace(face.font, face.bold, face.italic)]
            : []
        }),
      )
      const pending = withPendingFace(waiting)
      if (pending.length > 0) return bakeRefusal(bake, pending, { reason: "pending" })
    }
    const measured = await deckMeasure(host, [bake.fold], context)
    if (measured === undefined) return bakeRefusal(bake, required, { reason: "pending" })
    const pending = withPendingFace(measured.pending)
    if (pending.length > 0) return bakeRefusal(bake, pending, { reason: "pending" })
    const unread = required.flatMap((layer) => {
      const chars = doom.missingGlyphsIn(bake.fold, layer, measured.missing)
      return chars.length === 0 ? [] : [{ layer, chars }]
    })
    const shapingRefusal = (layers: readonly doom.NodeId[]) => {
      const details = layers.flatMap((layer) => {
        const text = doom.propOf(bake.fold.nodes.get(layer), "text")
        return text === undefined ? [] : shapingIn(text)
      })
      return bakeRefusal(bake, layers, {
        reason: "shaping",
        shaping: details.length === 0 ? ["the text exactly"] : [...new Set(details)],
      })
    }
    const coverageRefusal = () =>
      bakeRefusal(
        bake,
        unread.map(({ layer }) => layer),
        {
          reason: "coverage",
          characters: [...new Set(unread.flatMap(({ chars }) => chars))].join(""),
        },
      )
    if (measured.shared === undefined && unread.length > 0) return coverageRefusal()
    if (measured.shared !== undefined) {
      const shared = await measured.shared(bake.fold, bake.frame)
      if (typeof shared === "string") return bakeRefusal(bake, required, { reason: "pending" })
      const texts = new Map(
        required.flatMap((id) => {
          const text = doom.propOf(bake.fold.nodes.get(id), "text")
          return text === undefined ? [] : [[text, id] as const]
        }),
      )
      const differing = new Set<doom.NodeId>()
      const exact = doom.bakeLayout(bake.fold, bake.frame, (text, theme, width, fit) => {
        const next = shared(text, theme, width, fit)
        const id = texts.get(text)
        if (id !== undefined) {
          const old = measured.measure(text, theme, width, fit)
          if (
            Math.abs(old.w - next.w) > 0.5 ||
            Math.abs(old.h - next.h) > 0.5 ||
            Math.abs((old.wordFit?.w ?? 0) - (next.wordFit?.w ?? 0)) > 0.5
          )
            differing.add(id)
        }
        return next
      })
      const boxes = (writes: readonly doom.Write[]) =>
        new Map(
          writes.flatMap((write) => (write.prop === "box" ? [[write.node, write.value as doom.Box] as const] : [])),
        )
      const desired = boxes(exact)
      const legacy = boxes(doom.bakeLayout(bake.fold, bake.frame, measured.measure))
      const differs = [...new Set([...desired.keys(), ...legacy.keys()])].some((id) => {
        const prior = doom.propOf(bake.fold.nodes.get(id), "box")
        const left = desired.get(id) ?? prior
        const right = legacy.get(id) ?? prior
        return (
          left === undefined ||
          right === undefined ||
          (["x", "y", "w", "h"] as const).some((edge) => Math.abs(left[edge] - right[edge]) > 0.5)
        )
      })
      if (differs) {
        if (
          unread.length > 0 &&
          unread.some(({ layer }) => {
            const text = doom.propOf(bake.fold.nodes.get(layer), "text")
            return text === undefined || shapingIn(text).length === 0
          })
        )
          return coverageRefusal()
        return shapingRefusal(differing.size === 0 ? required : [...differing])
      }
    }
    step = steps.next(measured.measure)
  }
  return step.value
}

export async function landEdit(
  opened: Opened,
  compiled: doom.AgentEdit,
  host: DeckHost,
  lastRead: doom.Rev,
): Promise<Landed | Answer> {
  if (compiled.edit.writes.length === 0)
    return {
      landed: true,
      rev: opened.rev,
      problems: { problems: [], layout: "untouched" },
      bakedLayouts: [],
      unchanged: true,
    }
  const afterRead = compiled.edit.writes.flatMap(({ base }) => (base !== undefined && base > lastRead ? [base] : []))
  if (afterRead.length > 0) {
    const personRevs = await host.agentReads.byPerson(opened.deck, [...new Set(afterRead)]).catch(() => undefined)
    if (personRevs === undefined) return refused("store")
    const unseen = compiled.edit.writes.find(({ base }) => base !== undefined && personRevs.has(base))
    if (unseen !== undefined)
      return refused("stale", {
        node: unseen.node,
        prop: unseen.prop,
        note: "A person changed this property since you read the deck. Read it with get in a separate call, then revise your edit.",
      })
  }
  const landed = await host.edit(opened.deck, compiled.edit)
  if (!landed.ok) return hostRefused(landed)
  const laid = await layoutOf(host, compiled.after, () =>
    doom.touchedSlides(opened.fold, compiled.after, compiled.edit.writes),
  )
  return {
    landed: true,
    rev: landed.rev,
    problems: {
      problems: [...worded(compiled.after, compiled.problems), ...laid.problems],
      layout: laid.layout,
      ...(laid.unread === undefined ? {} : { unread: laid.unread }),
    },
    bakedLayouts: [
      ...new Set(
        compiled.edit.writes.flatMap((write) =>
          write.prop === "layout" && doom.propOf(compiled.after.nodes.get(write.node), "layout")?.mode === "none"
            ? [write.node]
            : [],
        ),
      ),
    ],
  }
}
