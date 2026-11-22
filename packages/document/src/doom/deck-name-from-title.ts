import { limits } from "../limits.js"
import { applyEdit } from "./apply-edit.js"
import type { Author, Doom, Write } from "./doom.js"
import { descendantsOf, get, slidesOf } from "./doom-walk.js"
import { rev } from "./ids.js"
import { placeholderTitle } from "./placeholder-title.js"
import { isRefusal } from "./refusal.js"

export const blankDeckName = "Blank deck"

const author: Author = { kind: "person", id: "deck-name" }

function firstTitleOf(doom: Doom): string {
  const first = slidesOf(doom)[0]
  if (first === undefined) return ""
  const title = descendantsOf(doom, first.id).find((node) => get(node, "role") === "title")
  return title === undefined ? "" : (get(title, "text")?.chars ?? "")
}

const nameOf = (chars: string): string => [...(chars.split("\n")[0] ?? "").trim()].slice(0, limits.name).join("").trim()

export function nameFromTitleWrites(doom: Doom, writes: readonly Write[]): readonly Write[] {
  const deck = [...doom.nodes.values()].find((node) => node.type === "deck")
  if (deck === undefined) return []
  const before = firstTitleOf(doom)
  const following = nameOf(before) !== "" && before !== placeholderTitle && deck.name === nameOf(before)
  if (deck.name !== blankDeckName && !following) return []
  const stamped = writes.map((write) => {
    const was = doom.revs.get(write.node)?.get(write.prop)
    return write.base !== undefined || was === undefined ? write : { ...write, base: was }
  })
  const after = applyEdit(doom, { once: "deck-name", author, writes: stamped, rev: rev(doom.rev + 1) })
  if (isRefusal(after)) return []
  const chars = firstTitleOf(after)
  const name = nameOf(chars)
  if (chars === before || name === "" || chars === placeholderTitle) return []
  return [{ node: deck.id, prop: "name", value: name }]
}
