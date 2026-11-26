import { limits } from "./limits.js"
import { applyBeforeFreeing } from "./apply-edit.js"
import type { Author, Doom, Node, Write } from "./doom.js"
import { descendantsOf, propOf, slidesOf } from "./doom-walk.js"
import { rev, type NodeId } from "./ids.js"
import { placeholderTitle } from "./placeholder-title.js"
import { isRefusal } from "./refusal.js"

export const blankDeckName = "Blank deck"

const author: Author = { kind: "person", id: "deck-name" }

function firstTitleOf(doom: Doom): { readonly id: NodeId | undefined; readonly chars: string } {
  const first = slidesOf(doom)[0]
  const title =
    first === undefined ? undefined : descendantsOf(doom, first.id).find((node) => propOf(node, "role") === "title")
  return { id: title?.id, chars: title === undefined ? "" : (propOf(title, "text")?.chars ?? "") }
}

const nameOf = (chars: string): string => [...(chars.split("\n")[0] ?? "").trim()].slice(0, limits.name).join("").trim()

const isBlank = (name: unknown): boolean => name === undefined || name === blankDeckName

function appliedOnce(doom: Doom, writes: readonly Write[]): Doom | undefined {
  const stamped = writes.map((write) => {
    const was = doom.revs.get(write.node)?.get(write.prop)
    return write.base !== undefined || was === undefined ? write : { ...write, base: was }
  })
  const after = applyBeforeFreeing(doom, { once: "deck-name", author, writes: stamped, rev: rev(doom.rev + 1) })
  return isRefusal(after) ? undefined : after
}

function nameFollowsTitle(deck: Node): boolean {
  const flag = propOf(deck, "nameFollows")
  return flag ?? isBlank(propOf(deck, "name"))
}

export function nameFromTitleWrites(doom: Doom, writes: readonly Write[], applied?: Doom): readonly Write[] {
  const deck = [...doom.nodes.values()].find((node) => node.type === "deck")
  if (deck === undefined) return []
  const ownWrites = writes.filter((write) => write.node === deck.id)
  const renamed = ownWrites.findLast((write) => write.prop === "name")
  if (renamed !== undefined) {
    if (ownWrites.some((write) => write.prop === "nameFollows")) return []
    const following = isBlank(renamed.value)
    return propOf(deck, "nameFollows") === following ? [] : [{ node: deck.id, prop: "nameFollows", value: following }]
  }
  const flagged = ownWrites.findLast((write) => write.prop === "nameFollows")
  if (!(flagged === undefined ? nameFollowsTitle(deck) : flagged.value === true)) return []
  const after = applied ?? appliedOnce(doom, writes)
  if (after === undefined) return []
  const { id, chars } = firstTitleOf(after)
  const before = firstTitleOf(doom).id
  if (before === id && !writes.some((write) => write.node === id && write.prop === "text")) return []
  const unwritten = chars === placeholderTitle
  if (unwritten && before === id) return []
  const typed = unwritten ? "" : nameOf(chars)
  const name = typed === "" ? blankDeckName : typed
  if (name === propOf(deck, "name")) return []
  const based = (prop: "name" | "nameFollows", value: unknown): Write => {
    const base = doom.revs.get(deck.id)?.get(prop)
    return { node: deck.id, prop, value, ...(base === undefined ? {} : { base }) }
  }
  const flag = propOf(deck, "nameFollows") === true || flagged !== undefined ? [] : [based("nameFollows", true)]
  return [based("name", name), ...flag]
}

export function deckNameFollows(doom: Doom): boolean {
  const deck = [...doom.nodes.values()].find((node) => node.type === "deck")
  return deck !== undefined && nameFollowsTitle(deck)
}
