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
    const next = shownAfter(view, each)
    if (next !== view) provisional?.set(next.rev, each.edit.once)
    view = next
  }
  return view
}

export function shownAfter(view: doom.Doom, each: Queued): doom.Doom {
  if (readGap(view, each) !== undefined) return view
  const next = appliedOn(view, each.edit)
  return doom.isRefusal(next) ? view : next
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
  return queueEditOn(server, shown(server, queue, provisional), provisional, edit)
}

export function queueEditOn(
  server: doom.Doom,
  view: doom.Doom,
  provisional: ReadonlyMap<doom.Rev, string>,
  edit: doom.Edit,
): Queued | doom.Refusal {
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

const writeKey = ({ node, prop }: doom.Write) => `${node}/${prop}`

type WriteBase = { readonly base?: doom.Rev; readonly after: string | null }
type Released = ReadonlyMap<string, WriteBase | null>

export function releasedBases(was: Queued, keep: readonly doom.Write[]): Released {
  const bases = new Map<string, WriteBase | null>()
  for (const [index, write] of was.edit.writes.entries()) {
    const key = writeKey(write)
    if (!bases.has(key))
      bases.set(key, { after: was.after[index] ?? null, ...(write.base === undefined ? {} : { base: write.base }) })
  }
  for (const write of keep) bases.set(writeKey(write), null)
  return bases
}

export function releaseBases(queued: Queued, released: ReadonlyMap<string, Released>): Queued {
  let writes: doom.Write[] | undefined
  let after: (string | null)[] | undefined
  for (const [index, name] of queued.after.entries()) {
    if (name === null) continue
    const bases = released.get(name)
    if (bases === undefined) continue
    const write = queued.edit.writes[index]!
    const found = bases.get(writeKey(write))
    if (found === null) continue
    writes ??= [...queued.edit.writes]
    after ??= [...queued.after]
    writes[index] = found?.base === undefined ? withoutBase(write) : { ...write, base: found.base }
    after[index] = found?.after ?? null
  }
  return writes === undefined || after === undefined ? queued : { ...queued, edit: { ...queued.edit, writes }, after }
}

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
  let view: doom.Doom | undefined
  for (const name of onces) {
    const turnedAt = server.onces.get(name) ?? (view ??= shown(server, queue)).onces.get(name)
    if (turnedAt !== undefined) owned.add(turnedAt)
  }
  return owned
}
