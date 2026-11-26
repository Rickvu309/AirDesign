import { picturesWantedMilliseconds, type DeckId } from "@airdesign/catalog"
import * as doom from "@airdesign/doom"
import type { Followed } from "./doom-deck-types.js"
import type { DoomRemote } from "./doom-remote.js"

type Following = {
  readonly deck: DeckId
  readonly since: DoomRemote["since"]
  readonly revision: () => doom.Rev
  readonly leave: () => Promise<Followed>
  readonly resync: () => Promise<boolean>
  readonly apply: (edits: readonly unknown[]) => boolean
  readonly tell: () => void
  readonly send: () => void
  readonly pause: (ms: number) => Promise<void>
}

const retryMilliseconds = 2_000

export function followDoom({ deck, since, revision, leave, resync, apply, tell, send, pause }: Following) {
  let held: AbortController | undefined
  let picturesUntil = 0
  const picturesWanted = () => Date.now() < picturesUntil

  let caught = revision()

  async function follow(signal: AbortSignal): Promise<Followed> {
    let wait = false
    while (!signal.aborted) {
      try {
        held = new AbortController()
        const answer = await since(
          { deck, rev: revision(), wait, ...(picturesWanted() ? { pictures: true } : {}) },
          AbortSignal.any([signal, held.signal]),
        )
        if (signal.aborted) return "stopped"
        if (!answer.ok && answer.refusal === "deck") return await leave()
        if (!answer.ok && answer.refusal === "cursor" && (await resync())) continue
        if (!answer.ok || (!apply(answer.edits) && !(await resync()))) {
          await pause(retryMilliseconds)
          continue
        }
        if (!wait) caught = revision()
        wait = true
        if (answer.pictures === true) {
          picturesUntil = Date.now() + picturesWantedMilliseconds
          tell()
        }
        send()
      } catch {
        if (signal.aborted) return "stopped"
        wait = false
        await pause(retryMilliseconds)
      }
    }
    return "stopped"
  }

  return { shown: { follow, picturesWanted, caught: () => caught }, wake: () => held?.abort() }
}

export function foldCaught(
  first: doom.Doom,
  edits: readonly unknown[],
  watch: (run: string | undefined, read: doom.Landed, before: doom.Doom) => void,
): doom.Doom | undefined {
  let next = first
  for (const raw of edits) {
    const read = doom.readLanded(raw, next)
    if (doom.isRefusal(read)) return undefined
    if (read.rev <= next.rev) continue
    if (read.rev !== next.rev + 1) return undefined
    const result = doom.applyEdit(next, read)
    if (doom.isRefusal(result)) return undefined
    watch(read.author.run, read, next)
    next = result
  }
  return next
}

export async function catchDoom({
  deck,
  since,
  revision,
  apply,
  resync,
}: Pick<Following, "deck" | "since" | "revision" | "apply" | "resync">): Promise<{ readonly ok: boolean }> {
  const answer = await since({ deck, rev: revision() })
  if (!answer.ok) return { ok: answer.refusal === "cursor" && (await resync()) }
  if (!apply(answer.edits)) return { ok: await resync() }
  while (revision() < answer.rev) {
    const more = await since({ deck, rev: revision() })
    if (!more.ok || more.edits.length === 0) return { ok: false }
    if (!apply(more.edits)) return { ok: await resync() }
  }
  return { ok: true }
}
