import { readLinkTarget, readSlideId, type LinkEdit, type ElementLink } from "@airdesign/document"
import { decodedXmlText, spliceBytes, type MarkupElement } from "./element-span.js"
import { partOf, relativeTarget, relsOf, slideAddresses } from "./package-address.js"
import { decodeUtf8, encodeUtf8 } from "./package-bytes.js"
import { withRunChild } from "./run-color.js"
import { requireMarkup } from "./part-markup.js"
import { shapeById } from "./shape-tree.js"
import { markupChildren } from "./text-value-route.js"
import { whole, type ElementAt, type Parts, type TraitXml } from "./xml-codec.js"

const attr = (element: MarkupElement, name: string) => {
  const value = element.attributes.find((each) => each.name === name)?.value
  return value === undefined ? undefined : decodedXmlText(value)
}
const escape = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

export type LinkAt = ElementAt & { readonly paragraph?: number; readonly run?: number }

type Children = ReturnType<typeof markupChildren>

function runOwner(bytes: Uint8Array, children: Children, shape: MarkupElement, at: number, runAt: number) {
  const body = children[shape.index]?.find((each) => each.kind === "p:txBody")
  const paragraph = body === undefined ? undefined : children[body.index]?.filter((each) => each.kind === "a:p")[at]
  const run =
    paragraph === undefined
      ? undefined
      : children[paragraph.index]?.filter((each) => ["a:r", "a:br", "a:fld"].includes(each.kind))[runAt]
  if (run === undefined) return null
  const holder = children[run.index]?.find((each) => each.kind === "a:rPr")
  if (holder === undefined) return { bytes, holder: run, held: [], click: undefined, missingProperties: true }
  const held = children[holder.index] ?? []
  return { bytes, holder, held, click: held.find((each) => each.kind === "a:hlinkClick") }
}

function owner(parts: Parts, at: LinkAt) {
  const bytes = parts.get(at.part)
  if (bytes === undefined) return null
  const { elements } = requireMarkup(bytes)
  const children = markupChildren(elements)
  const shape = shapeById(elements, at.shape)
  if (shape.kind !== "p:sp") return null
  if (at.paragraph !== undefined && at.run !== undefined) return runOwner(bytes, children, shape, at.paragraph, at.run)
  const visual = children[shape.index]?.find((each) => each.kind === "p:nvSpPr")
  const holder = visual === undefined ? undefined : children[visual.index]?.find((each) => each.kind === "p:cNvPr")
  if (holder === undefined) return null
  const held = children[holder.index] ?? []
  return { bytes, holder, held, click: held.find((each) => each.kind === "a:hlinkClick") }
}

export type { ElementLink } from "@airdesign/document"

export type RelationshipsRead = Map<string, readonly MarkupElement[] | undefined>

function relationships(parts: Parts, part: string, read: RelationshipsRead): readonly MarkupElement[] | undefined {
  const name = relsOf(part)
  if (!read.has(name)) {
    const rels = parts.get(name)
    read.set(name, rels === undefined ? undefined : requireMarkup(rels).elements)
  }
  return read.get(name)
}

export function shownLink(parts: Parts, at: LinkAt): ElementLink | null {
  const found = owner(parts, at)
  return found === null ? null : destination(parts, at.part, found.click, new Map())
}

export function shownRunLink(
  parts: Parts,
  part: string,
  bytes: Uint8Array,
  children: Children,
  shape: MarkupElement,
  paragraph: number,
  run: number,
  read: RelationshipsRead,
): ElementLink | null {
  if (shape.kind !== "p:sp") return null
  const found = runOwner(bytes, children, shape, paragraph, run)
  return found === null ? null : destination(parts, part, found.click, read)
}

function destination(
  parts: Parts,
  part: string,
  click: MarkupElement | undefined,
  read: RelationshipsRead,
): ElementLink {
  if (click === undefined) return { kind: "none" }
  const id = attr(click, "r:id")
  const rel = relationships(parts, part, read)?.find((each) => each.kind === "Relationship" && attr(each, "Id") === id)
  if (rel === undefined) return { kind: "unsupported" }
  const target = attr(rel, "Target")
  const action = attr(click, "action")
  if (
    (action === undefined || action === "") &&
    attr(rel, "Type")?.endsWith("/hyperlink") &&
    attr(rel, "TargetMode") === "External"
  )
    return readLinkTarget({ kind: "url", url: target }) ?? { kind: "unsupported" }
  if (
    action === "ppaction://hlinksldjump" &&
    attr(rel, "Type")?.endsWith("/slide") &&
    attr(rel, "TargetMode") !== "External" &&
    target !== undefined
  ) {
    const address = slideAddresses(parts).find((each) => each.part === partOf(part, target))
    const slide = readSlideId(address?.slide)
    if (slide !== undefined) return { kind: "slide", slide }
  }
  return { kind: "unsupported" }
}

export function writtenLink(parts: Parts, at: LinkAt, value: LinkEdit): Parts {
  if (JSON.stringify(shownLink(parts, at)) === JSON.stringify(value)) return parts
  const found = owner(parts, at)
  if (found === null) throw new Error("link-owner")
  const next = new Map(parts)
  let xml = ""
  if (value.kind !== "none") {
    const destination =
      value.kind === "slide" ? slideAddresses(parts).find((each) => each.slide === value.slide) : undefined
    if (value.kind === "slide" && destination === undefined) return writtenLink(parts, at, { kind: "none" })
    const path = relsOf(at.part)
    const bytes =
      parts.get(path) ??
      encodeUtf8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>')
    const { elements } = requireMarkup(bytes)
    const root = elements[0]!
    const ids = new Set(elements.map((each) => attr(each, "Id")))
    let serial = 1
    while (ids.has(`rId${String(serial)}`)) serial += 1
    const id = `rId${String(serial)}`
    const family = elements.find(
      (each) => each.kind === "Relationship" && attr(each, "Type")?.includes("/relationships/"),
    )
    const prefix =
      family === undefined
        ? "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        : attr(family, "Type")!.split("/relationships/")[0] + "/relationships"
    const relation =
      value.kind === "url"
        ? `<Relationship Id="${id}" Type="${prefix}/hyperlink" Target="${escape(value.url)}" TargetMode="External"/>`
        : `<Relationship Id="${id}" Type="${prefix}/slide" Target="${escape(relativeTarget(at.part, destination!.part))}"/>`
    const edit = root.selfClosing
      ? { start: root.openEnd - 2, end: root.openEnd, next: encodeUtf8(`>${relation}</Relationships>`) }
      : { start: root.closeStart, end: root.closeStart, next: encodeUtf8(relation) }
    next.set(path, spliceBytes(bytes, [edit]))
    const extras =
      found.click?.attributes
        .filter((each) => !["r:id", "action", "invalidUrl"].includes(each.name))
        .map((each) => ` ${each.name}="${escape(decodedXmlText(each.value))}"`)
        .join("") ?? ""
    const inner =
      found.click === undefined || found.click.selfClosing
        ? ""
        : decodeUtf8(found.bytes.subarray(found.click.openEnd, found.click.closeStart))
    xml = `<a:hlinkClick xmlns:r="${prefix}" r:id="${id}"${value.kind === "slide" ? ' action="ppaction://hlinksldjump"' : ""}${extras}>${inner}</a:hlinkClick>`
  }
  if ("missingProperties" in found && xml !== "") xml = `<a:rPr>${xml}</a:rPr>`
  const { bytes, holder, click } = found
  if (holder.kind === "a:rPr") {
    next.set(
      at.part,
      spliceBytes(bytes, [
        {
          start: holder.start,
          end: holder.end,
          next: withRunChild(
            bytes.subarray(holder.start, holder.end),
            new Set(["a:hlinkClick"]),
            "a:hlinkClick",
            encodeUtf8(xml),
          ),
        },
      ]),
    )
  } else if (click !== undefined)
    next.set(at.part, spliceBytes(bytes, [{ start: click.start, end: click.end, next: encodeUtf8(xml) }]))
  else if (xml !== "") {
    const edit = holder.selfClosing
      ? { start: holder.openEnd - 2, end: holder.openEnd, next: encodeUtf8(`>${xml}</${holder.kind}>`) }
      : { start: holder.openEnd, end: holder.openEnd, next: encodeUtf8(xml) }
    next.set(at.part, spliceBytes(bytes, [edit]))
  }
  return next
}

export const linkXml: TraitXml<"link"> = {
  slot: null,
  fields: {
    target: whole({
      read: (parts, at) => {
        const value = shownLink(parts, at)
        return value?.kind === "unsupported" ? null : value
      },
      write: writtenLink,
    }),
  },
}

export function withoutSlideLinks(parts: Map<string, Uint8Array>, target: string): void {
  for (const [path, bytes] of parts) {
    if (!path.endsWith(".rels")) continue
    const marker = path.lastIndexOf("_rels/")
    if (marker < 0) continue
    const source = path.slice(0, marker) + path.slice(marker + 6, -5)
    if (!source.startsWith("ppt/slides/")) continue
    const rels = requireMarkup(bytes).elements.filter(
      (each) =>
        each.kind === "Relationship" &&
        attr(each, "Type")?.endsWith("/slide") &&
        attr(each, "TargetMode") !== "External" &&
        partOf(source, attr(each, "Target") ?? "") === target,
    )
    if (rels.length === 0) continue
    const ids = new Set(rels.map((each) => attr(each, "Id")))
    const ownerBytes = parts.get(source)
    if (ownerBytes !== undefined) {
      const links = requireMarkup(ownerBytes).elements.filter(
        (each) => (each.kind === "a:hlinkClick" || each.kind === "a:hlinkMouseOver") && ids.has(attr(each, "r:id")),
      )
      if (links.length > 0)
        parts.set(
          source,
          spliceBytes(
            ownerBytes,
            links.map((each) => ({ start: each.start, end: each.end, next: encodeUtf8("") })),
          ),
        )
    }
    parts.set(
      path,
      spliceBytes(
        bytes,
        rels.map((each) => ({ start: each.start, end: each.end, next: encodeUtf8("") })),
      ),
    )
  }
}
