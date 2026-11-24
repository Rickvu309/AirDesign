import { applyEdit, isRefusal, rev, type Doom, type Landed, type Write } from "../index.js"
import { once, person } from "../sample-deck.js"

export function step(doom: Doom, writes: readonly Write[], by = person) {
  const edit: Landed = { once: once(), author: by, writes, rev: rev(doom.rev + 1) }
  const after = applyEdit(doom, edit)
  if (isRefusal(after)) throw new Error(`refused ${JSON.stringify(after)}`)
  return { before: doom, after, edit }
}
