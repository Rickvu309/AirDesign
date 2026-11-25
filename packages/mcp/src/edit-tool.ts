import { fallbackFont, readDeckEdit, readNamedDeck, servedFontName } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"

import { answered, hostRefused, refused, doomRefused, type ToolResult } from "./answer.js"
import { type Findings, findingsNote, layoutOf, listed } from "./layout-answer.js"
import type { DeckHost } from "./deck-host.js"
import { deckMeasure } from "./deck-measure.js"
import { imageNames, imageProblem, imagesPerCall, pictureSizes, withAssets, type NamedImages } from "./named-image.js"
import { onceIds } from "./once-ids.js"
import {
  componentFindings,
  componentFindingsNote,
  sampleFindings,
  type ComponentReadFinding,
} from "./component-answer.js"
import { withCatalogFonts } from "./font-names.js"
import { templateWords, writtenTemplates, type WrittenTemplate } from "./template-answer.js"

type Read =
  | { readonly ok: true; readonly changes: readonly doom.AgentChange[] }
  | { readonly ok: false; readonly result: ToolResult }

function readChanges(raw: readonly unknown[]): Read {
  const changes: doom.AgentChange[] = []
  for (const [at, each] of raw.entries()) {
    const read = doom.readAgentChange(each)
    if ("refused" in read) {
      const op = typeof each === "object" && each !== null ? (each as { op?: unknown }).op : undefined
      return { ok: false, result: doomRefused({ ...read, change: typeof op === "string" ? op : "change", at }) }
    }
    changes.push(read)
  }
  return { ok: true, changes }
}

type Added = { readonly id: string; readonly kind: string; readonly change?: number }

function rootsOfEdit(edit: doom.Edit, added: readonly doom.AddedNode[]): readonly Added[] {
  const placed = added.filter((each) => each.kind !== "slideRow" && each.kind !== "template")
  const made = new Set<string>(placed.map((each) => each.id))
  const parents = new Map<string, string>()
  for (const write of edit.writes)
    if (write.prop === "parent" && write.value !== null) parents.set(write.node, (write.value as { id: string }).id)
  return placed.filter((each) => !made.has(parents.get(each.id) ?? ""))
}

const makesRoot = (change: doom.AgentChange) =>
  change.op === "add" || change.op === "wrap" || (change.op === "slide" && change.add !== undefined)

function rootsInFold(fold: doom.Doom, client: string, changes: readonly doom.AgentChange[]): readonly Added[] {
  const mine = [...fold.nodes.values()].filter((node) => node.id.startsWith(`${client}:`) && node.type !== "slideRow")
  const made = new Set<string>(mine.map((node) => node.id))
  const roots = mine.filter((node) => !made.has((node as { parent?: { id: string } | null }).parent?.id ?? ""))
  const making = changes.flatMap((change, at) => (makesRoot(change) ? [at] : []))
  return roots.map((node, at) => ({
    id: node.id,
    kind: doom.agentKind(node),
    ...(making.length === roots.length ? { change: making[at] as number } : {}),
  }))
}

type UpdatedComponent = { readonly id: doom.NodeId; readonly partCount: number }
function landedAnswer(
  deck: string,
  rev: number,
  run: string,
  added: readonly Added[],
  findings: Findings = { findings: [], layout: "untouched" },
  bakedLayouts: readonly doom.NodeId[] = [],
  components: readonly ComponentReadFinding[] = [],
  updatedComponents: readonly UpdatedComponent[] = [],
  templates: readonly WrittenTemplate[] = [],
): ToolResult {
  const words = added.map(
    (each) => `${each.id} ${each.kind}${each.change === undefined ? "" : ` (change ${String(each.change)})`}`,
  )
  const lead = `Landed at rev ${String(rev)}${added.length === 0 ? "" : `, adding ${words.join(", ")}`}. Send runId with your next edits, and to airdesign_stop_run when done.`
  const found = findings.findings.length === 0 ? {} : { findings: listed(findings.findings) }
  const updates = updatedComponents.map(
    ({ id, partCount }) => `Updated linked template ${id} (${partCount} generated parts).`,
  )
  const written = templates.map(templateWords)
  const notes = [lead, ...written, ...updates, ...componentFindingsNote(components), ...findingsNote(findings)]
  return answered(notes.join(" "), {
    ok: true,
    deck,
    rev,
    runId: run,
    added,
    ...(templates.length === 0 ? {} : { templates }),
    ...(updatedComponents.length === 0 ? {} : { updatedComponents }),
    ...(bakedLayouts.length === 0 ? {} : { bakedLayouts }),
    ...found,
    ...(components.length === 0 ? {} : { componentFindings: components }),
  })
}

function unchangedAnswer(deck: string, rev: number, run: string | undefined): ToolResult {
  const lead = `Nothing landed: the deck already holds every value you set, so it stays at rev ${String(rev)}.`
  const next =
    run === undefined ? "No run started." : "Send runId with your next edits, and to airdesign_stop_run when done."
  return answered(`${lead} ${next}`, {
    ok: true,
    deck,
    rev,
    unchanged: true,
    ...(run === undefined ? {} : { runId: run }),
    added: [],
  })
}

export type Agent = { readonly id: string; readonly name?: string | undefined }

function toldRefusal(refusal: {
  readonly refusal: "field" | "deck" | "base" | "batch"
  readonly field?: string
  readonly fault?: "missing" | "unknown" | "form"
  readonly form?: string
}): ToolResult {
  return refused(refusal.refusal, {
    ...(refusal.field === undefined ? {} : { field: refusal.field }),
    ...(refusal.fault === undefined ? {} : { fault: refusal.fault }),
    ...(refusal.form === undefined ? {} : { form: refusal.form }),
  })
}

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
): ToolResult {
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

async function compileMeasured(
  fold: doom.Doom,
  changes: readonly doom.AgentChange[],
  by: doom.EditBy,
  host: DeckHost,
  pendingFonts: ReadonlySet<string>,
): Promise<doom.AgentEdit | doom.AgentRefusal | ToolResult> {
  const steps = doom.agentEditSteps(fold, changes, by)
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

export async function editDeckTool(
  raw: unknown,
  agent: Agent,
  once: string,
  host: DeckHost,
  pendingFonts: ReadonlySet<string>,
): Promise<ToolResult> {
  const named = readNamedDeck(raw)
  if (!named.ok) return toldRefusal(named)
  const opened = await host.open(named.deck)
  if (!opened.ok) return hostRefused(opened)
  const parsed = readDeckEdit(raw)
  if (!parsed.ok) return toldRefusal(parsed)
  const read = readChanges(parsed.changes)
  if (!read.ok) return read.result
  const fonts = withCatalogFonts(read.changes)
  if (!fonts.ok) return fonts.result
  if (parsed.base > opened.rev) return refused("base", { rev: opened.rev })
  const ids = onceIds(once)
  const run = parsed.runId ?? ids.run
  const before = opened.fold.onces.get(once)
  if (before !== undefined) {
    const roots = rootsInFold(opened.fold, ids.client, read.changes)
    const touched = () =>
      doom.touchedSlides(
        opened.fold,
        opened.fold,
        roots.map((root) => ({ node: root.id as doom.NodeId, prop: "type" as const })),
      )
    return landedAnswer(opened.deck, before, run, roots, await layoutOf(host, opened.fold, touched))
  }
  const names = imageNames(fonts.changes)
  const found: NamedImages | undefined =
    names.length > 0 && host.images !== undefined
      ? new Map([
          ...(await host.images(parsed.deck, names.slice(0, imagesPerCall))),
          ...names.slice(imagesPerCall).map((each) => [each, { ok: false, refusal: "many" }] as const),
        ])
      : undefined
  const problem = imageProblem(fonts.changes, found)
  if (problem !== undefined) return problem
  const changes = found === undefined ? fonts.changes : withAssets(fonts.changes, found)
  const samples: doom.ComponentEditSample[] = []
  const compile = (measure?: doom.Measure, sample = false) =>
    compileMeasured(
      opened.fold,
      changes,
      {
        author: {
          kind: "agent",
          id: agent.id,
          run,
          ...(parsed.runId === undefined && agent.name !== undefined ? { name: agent.name } : {}),
        },
        once,
        mint: onceIds(once).mint,
        read: doom.readingOf(opened.fold, parsed.base),
        ...(found === undefined ? {} : { pictures: pictureSizes(found) }),
        ...(measure === undefined ? {} : { measure }),
        ...(sample ? { componentSample: (sample: doom.ComponentEditSample) => samples.push(sample) } : {}),
        ...(parsed.runId === undefined ? { phase: "start" as const } : {}),
      },
      host,
      pendingFonts,
    )
  let measure: doom.Measure | undefined
  let compiled = await compile(undefined, true)
  if ("answer" in compiled) return compiled
  if (samples.length > 0 && host.measure !== undefined) {
    const measured = await deckMeasure(
      host,
      [opened.fold, ...samples.map(({ view }) => view), ...("refused" in compiled ? [] : [compiled.after])],
      undefined,
      samples.flatMap(({ texts }) => texts),
    )
    if (measured === undefined)
      return refused("fonts", { note: "Unable to measure the linked chart. Try again when its fonts are available." })
    measure = measured.measure
    compiled = await compile(measure)
  } else if (!("refused" in compiled)) {
    const instanceWrites = compiled.edit.writes.some(({ prop, value }) => prop === "instance" && value !== null)
    if (instanceWrites || doom.mayLeaveDeck(opened.fold, compiled.edit.writes) || changes.some(doom.addsCardRow)) {
      const measured = await deckMeasure(host, [opened.fold, compiled.after])
      if (instanceWrites && host.measure !== undefined && measured === undefined)
        return refused("fonts", {
          note: "The deck fonts are unavailable. Read the deck again and resend when they load.",
        })
      measure = measured?.measure
      if (measure !== undefined) compiled = await compile(measure)
    }
  }
  if ("answer" in compiled) return compiled
  if ("refused" in compiled) return doomRefused(compiled, { rev: opened.rev })
  if (compiled.edit.readBase !== undefined && parsed.base !== opened.rev) return refused("stale", { rev: opened.rev })
  if (compiled.edit.writes.length === 0) return unchangedAnswer(opened.deck, opened.rev, parsed.runId)
  const landed = await host.edit(parsed.deck, compiled.edit)
  if (!landed.ok) return hostRefused(landed)
  const laid = await layoutOf(host, compiled.after, () =>
    doom.touchedSlides(opened.fold, compiled.after, compiled.edit.writes),
  )
  const templates = writtenTemplates(compiled.edit, compiled.after)
  const regenerated = new Set<doom.NodeId>()
  const updated = new Map<doom.NodeId, UpdatedComponent>()
  for (const { node, prop, value } of compiled.edit.writes) {
    if (prop !== "instance" || value === null) continue
    const instance = doom.props.instance.read(value)
    if (doom.isRefusal(instance)) continue
    regenerated.add(instance.generated)
    for (const part of instance.parts) regenerated.add(part.node)
    if (doom.propOf(opened.fold.nodes.get(node), "instance") !== undefined)
      updated.set(node, { id: node, partCount: instance.parts.length })
  }
  return landedAnswer(
    landed.deck,
    landed.rev,
    run,
    rootsOfEdit(
      compiled.edit,
      compiled.added.filter(({ id }) => !regenerated.has(id)),
    ),
    {
      findings: [...compiled.findings, ...laid.findings],
      layout: laid.layout,
      ...(laid.unread === undefined ? {} : { unread: laid.unread }),
    },
    compiled.edit.writes.flatMap((write) =>
      write.prop === "layout" && doom.propOf(compiled.after.nodes.get(write.node), "layout")?.mode === "none"
        ? [write.node]
        : [],
    ),
    [
      ...sampleFindings(
        compiled.after,
        templates.map(({ id }) => id),
        measure,
      ),
      ...componentFindings(
        compiled.after,
        compiled.edit.writes.flatMap(({ node, prop, value }) => (prop === "instance" && value !== null ? [node] : [])),
        measure,
      ),
    ],
    [...updated.values()],
    templates,
  )
}
