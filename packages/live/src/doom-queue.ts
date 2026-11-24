import * as doom from "@airdesign/doom"

export type Queued = {
  readonly edit: doom.Edit
  readonly after: readonly (string | null)[]
  readonly follows?: string
  readonly afterRead?: readonly string[]
}

export function readGap(fold: doom.Doom, { edit, afterRead }: Queued): string | undefined {
  if (edit.readBase === undefined || afterRead === undefined) return undefined
  const base = edit.readBase - afterRead.length
  return afterRead.find((once, index) => fold.onces.get(once) !== base + index + 1)
}

export function shown(server: doom.Doom, queue: readonly Queued[], provisional?: Map<doom.Rev, string>): doom.Doom {
  let view = server
  for (const each of queue) {
    if (readGap(view, each) !== undefined) continue
    const next = appliedOn(view, each.edit)
    if (doom.isRefusal(next) || next === view) continue
    provisional?.set(next.rev, each.edit.once)
    view = next
  }
  return view
}

export function appliedOn(view: doom.Doom, edit: doom.Edit): doom.Doom | doom.Refusal {
  const writes = edit.writes.map(({ base: _sent, ...write }) => {
    const was = view.revs.get(write.node)?.get(write.prop)
    return was === undefined ? write : { ...write, base: was }
  })
  return doom.applyEdit(view, { ...edit, writes, rev: doom.rev(view.rev + 1) })
}

const compareAndSet = (key: doom.WriteKey): boolean =>
  !key.startsWith("theme.") && doom.props[key as doom.PropName].conflict === "base"

function withoutBase({ base: _base, ...write }: doom.Write): doom.Write {
  return write
}

export function queueEdit(server: doom.Doom, queue: readonly Queued[], edit: doom.Edit): Queued | doom.Refusal {
  const provisional = new Map<doom.Rev, string>()
  const view = shown(server, queue, provisional)
  if (edit.readBase !== undefined && edit.readBase !== view.rev) return { refused: "stale" }
  const after: (string | null)[] = []
  const writes: doom.Write[] = []
  for (const write of edit.writes) {
    const read = write.base ?? (compareAndSet(write.prop) ? view.revs.get(write.node)?.get(write.prop) : undefined)
    if (read === undefined) {
      after.push(null)
      writes.push(withoutBase(write))
    } else if (read <= server.rev) {
      after.push(null)
      writes.push({ ...write, base: read })
    } else {
      const once = provisional.get(read)
      if (once === undefined) return { refused: "stale", node: write.node, prop: write.prop }
      after.push(once)
      writes.push(withoutBase(write))
    }
  }
  return {
    edit: { ...edit, writes },
    after,
    ...(edit.readBase === undefined ? {} : { afterRead: [...provisional.values()] }),
  }
}

export function sendable(queued: Queued): doom.Edit {
  if (queued.after.some((once) => once !== null)) throw new Error("a base still names a queued edit")
  return queued.edit
}

export function landed(queue: readonly Queued[], once: string, rev: doom.Rev): Queued[] {
  const rest: Queued[] = []
  for (const each of queue) {
    if (each.edit.once === once) continue
    if (!each.after.includes(once)) {
      rest.push(each)
      continue
    }
    rest.push({
      ...each,
      edit: {
        ...each.edit,
        writes: each.edit.writes.map((write, index) => (each.after[index] === once ? { ...write, base: rev } : write)),
      },
      after: each.after.map((name) => (name === once ? null : name)),
    })
  }
  return rest
}

const sameWrite = (a: doom.Write, b: doom.Write) => a.node === b.node && a.prop === b.prop

function released(queue: readonly Queued[], once: string, was: Queued, keep: readonly doom.Write[]): Queued[] {
  const read = (write: doom.Write) => was.edit.writes.findIndex((each) => sameWrite(each, write))
  return queue.map((each) => {
    if (!each.after.includes(once)) return each
    const freed = each.edit.writes.map(
      (write, index) => each.after[index] === once && !keep.some((kept) => sameWrite(kept, write)),
    )
    return {
      ...each,
      edit: {
        ...each.edit,
        writes: each.edit.writes.map((write, index) => {
          if (!freed[index]) return write
          const base = was.edit.writes[read(write)]?.base
          return base === undefined ? withoutBase(write) : { ...write, base }
        }),
      },
      after: each.after.map((name, index) =>
        freed[index] ? (was.after[read(each.edit.writes[index]!)] ?? null) : name,
      ),
    }
  })
}

export function trimmed(queue: readonly Queued[], once: string, keep: readonly doom.Write[]): Queued[] {
  const head = queue.find((each) => each.edit.once === once)
  if (head === undefined) return [...queue]
  const kept = (each: Queued): Queued[] =>
    each !== head
      ? [each]
      : keep.length === 0
        ? []
        : [{ ...each, edit: { ...each.edit, writes: keep }, after: keep.map(() => null) }]
  return released(queue.flatMap(kept), once, head, keep)
}

export function rewritten(
  server: doom.Doom,
  queue: readonly Queued[],
  once: string,
  writes: readonly doom.Write[],
): Queued[] | doom.Refusal {
  const at = queue.findIndex((each) => each.edit.once === once)
  const was = queue[at]
  if (was === undefined) return [...queue]
  const made = queueEdit(server, queue.slice(0, at), { ...was.edit, writes })
  if (doom.isRefusal(made)) return made
  return [...queue.slice(0, at), made, ...released(queue.slice(at + 1), once, was, writes)]
}

export const skipped = (queue: readonly Queued[], once: string): Queued[] => trimmed(queue, once, [])

export function dropped(
  queue: readonly Queued[],
  once: string,
): { readonly queue: readonly Queued[]; readonly gone: readonly string[] } {
  if (!queue.some((each) => each.edit.once === once)) return { queue, gone: [] }
  const gone = new Set([once])
  for (const each of queue)
    if (
      each.after.some((name) => name !== null && gone.has(name)) ||
      each.afterRead?.some((name) => gone.has(name)) === true ||
      (each.follows !== undefined && gone.has(each.follows))
    )
      gone.add(each.edit.once)
  return {
    queue: queue.filter((each) => !gone.has(each.edit.once)),
    gone: queue.filter((each) => gone.has(each.edit.once)).map((each) => each.edit.once),
  }
}

export function revIn(server: doom.Doom, queue: readonly Queued[], once: string): doom.Rev | undefined {
  return server.onces.get(once) ?? shown(server, queue).onces.get(once)
}

export function ownedIn(server: doom.Doom, queue: readonly Queued[], onces: Iterable<string>): Set<doom.Rev> {
  const owned = new Set<doom.Rev>()
  for (const name of onces) {
    const turnedAt = revIn(server, queue, name)
    if (turnedAt !== undefined) owned.add(turnedAt)
  }
  return owned
}
