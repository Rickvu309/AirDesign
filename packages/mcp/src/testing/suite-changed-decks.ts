import * as doom from "@airdesign/doom"

import { evalDeck, named, person } from "./eval-deck.js"

export const heldRun = "held"

export function runningWith(then: readonly doom.Write[], by: doom.Author = person): doom.Doom {
  const start = evalDeck()
  const began = doom.applyEdit(start, {
    once: "begin",
    author: { kind: "agent", id: "eval", run: heldRun },
    writes: [],
    phase: "start",
    rev: doom.rev(start.rev + 1),
  })
  if (doom.isRefusal(began)) throw new Error("begin")
  if (then.length === 0) return began
  const next = doom.applyEdit(began, { once: "then", author: by, writes: then, rev: doom.rev(began.rev + 1) })
  if (doom.isRefusal(next)) throw new Error("then")
  return next
}

export const noteTouched = () => runningWith([{ node: named.note, prop: "name", value: "Mine" }])

export function stoppedRun(): doom.Doom {
  const began = runningWith([])
  const stopped = doom.applyEdit(began, {
    once: "end",
    author: { kind: "agent", id: "eval", run: heldRun },
    writes: [],
    phase: "stop",
    rev: doom.rev(began.rev + 1),
  })
  if (doom.isRefusal(stopped)) throw new Error("end")
  return stopped
}
