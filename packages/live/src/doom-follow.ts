import { screenshotsWantedMilliseconds, type DeckId } from "@airdesign/catalog"
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
  const selectionChanged = Symbol()
  let selection: Parameters<DoomRemote["since"]>[0]["selection"]
  function reportSelection(next: typeof selection): void {
    if (next?.slide === selection?.slide && next?.ids === selection?.ids) return
    selection = next
    held?.abort(selectionChanged)
  }

  let screenshotsUntil = 0
  const screenshotsWanted = () => Date.now() < screenshotsUntil

  let caught = revision()

  async function follow(signal: AbortSignal): Promise<Followed> {
    let wait = false
    while (!signal.aborted) {
      const request = new AbortController()
      held = request
      try {
        const answer = await since(
          {
            deck,
            rev: revision(),
            wait,
            ...(selection === undefined ? {} : { selection }),
            ...(screenshotsWanted() ? { screenshots: true } : {}),
          },
          AbortSignal.any([signal, request.signal]),
        )
        if (signal.aborted) return "stopped"
        if (!answer.ok && answer.refusal === "deck") return await leave()
        if (!answer.ok && answer.refusal === "cursor" && (await resync())) continue
        if (!answer.ok || (!apply(answer.edits) && !(await resync()))) {
          await pause(retryMilliseconds)
          continue
        }
        if (!wait) caught = doom.rev(Math.max(revision(), answer.rev))
        wait = true
        if (answer.screenshots === true) {
          screenshotsUntil = Date.now() + screenshotsWantedMilliseconds
          tell()
        }
        send()
      } catch {
        if (signal.aborted) return "stopped"
        if (request.signal.reason === selectionChanged) continue
        wait = false
        await pause(retryMilliseconds)
      }
    }
    return "stopped"
  }

  return { shown: { follow, reportSelection, screenshotsWanted, caught: () => caught }, wake: () => held?.abort() }
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
