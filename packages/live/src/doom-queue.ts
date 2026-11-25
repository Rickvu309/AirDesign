import * as doom from "@airdesign/doom"

export const componentFields = ["data", "tokens", "variant"] as const
export type Regeneration = {
  readonly frame: doom.NodeId
  readonly fields: readonly (typeof componentFields)[number][]
}

export function regenerationFor(frame: doom.NodeId, patch: doom.ComponentPatch): Regeneration {
  return { frame, fields: componentFields.filter((field) => Object.hasOwn(patch, field)) }
}

export type Suppression = {
  readonly frame: doom.NodeId
  readonly node: doom.NodeId
  readonly key: doom.PartKey
}

export type Queued = {
  readonly edit: doom.Edit
  readonly after: readonly (string | null)[]
  readonly follows?: string
  readonly afterRead?: readonly string[]
  readonly regeneration?: Regeneration
  readonly suppressions?: readonly Suppression[]
  readonly turnFrom?: readonly string[]
  readonly turnSource?: doom.RunEdit
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

export function queueProjection() {
  type Projection = {
    readonly server: doom.Doom
    readonly queue: readonly Queued[]
    readonly view: doom.Doom
    readonly provisional: Map<doom.Rev, string>
  }
  let memo: Projection | undefined
  return {
    read(server: doom.Doom, queue: readonly Queued[]): Projection {
      if (memo?.server !== server || memo.queue !== queue) {
        const provisional = new Map<doom.Rev, string>()
        memo = { server, queue, view: shown(server, queue, provisional), provisional }
      }
      return memo
    },
    adopt(server: doom.Doom, queue: readonly Queued[], view: doom.Doom, provisional: Map<doom.Rev, string>) {
      memo = { server, queue, view, provisional }
    },
    append(server: doom.Doom, queue: readonly Queued[], view: doom.Doom, once: string) {
      if (memo === undefined) return
      const { provisional } = memo
      if (view !== memo.view) provisional.set(view.rev, once)
      memo = { server, queue, view, provisional }
    },
  }
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

export function acceptedWithoutRow(edit: doom.Edit, rev: number): boolean {
  return edit.readBase === rev && edit.writes.length === 0 && edit.phase === undefined && edit.runUndo === undefined
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

export function settled(server: doom.Doom, queue: readonly Queued[]): readonly Queued[] {
  const names = new Set(queue.flatMap((each) => [each.edit.once, ...each.after]))
  let pending = queue
  for (const once of names) {
    if (once === null) continue
    const at = server.onces.get(once)
    if (at !== undefined) pending = landed(pending, once, at)
  }
  return pending
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

export function ownedAt(view: doom.Doom, onces: Iterable<string>): Set<doom.Rev> {
  const owned = new Set<doom.Rev>()
  for (const once of onces) {
    const at = view.onces.get(once)
    if (at !== undefined) owned.add(at)
  }
  return owned
}
