import { scene } from "@airdesign/document"

export type Queued = { readonly edit: scene.Edit; readonly after: readonly (string | null)[] }

export const shown = (server: scene.Scene, queue: readonly Queued[]): scene.Scene =>
  scene.viewOf(
    server,
    queue.map((each) => each.edit),
  )

export function appliedOn(view: scene.Scene, edit: scene.Edit): scene.Scene | scene.Refusal {
  const writes = edit.writes.map(({ base: _sent, ...write }) => {
    const was = view.revs.get(write.node)?.get(write.prop)
    return was === undefined ? write : { ...write, base: was }
  })
  return scene.applyEdit(view, { ...edit, writes, rev: scene.rev(view.rev + 1) })
}

export function provisionalRevs(server: scene.Scene, edits: readonly scene.Edit[]): ReadonlyMap<scene.Rev, string> {
  const revs = new Map<scene.Rev, string>()
  let view = server
  for (const edit of edits) {
    const next = scene.viewOf(view, [edit])
    if (next === view) continue
    revs.set(next.rev, edit.once)
    view = next
  }
  return revs
}

const compareAndSet = (key: scene.WriteKey): boolean =>
  !key.startsWith("theme.") && scene.props[key as scene.PropName].conflict === "base"

function withoutBase({ base: _base, ...write }: scene.Write): scene.Write {
  return write
}

export function queueEdit(server: scene.Scene, queue: readonly Queued[], edit: scene.Edit): Queued | scene.Refusal {
  const view = shown(server, queue)
  const provisional = provisionalRevs(
    server,
    queue.map((each) => each.edit),
  )
  const after: (string | null)[] = []
  const writes: scene.Write[] = []
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
  return { edit: { ...edit, writes }, after }
}

export function sendable(queued: Queued): scene.Edit {
  if (queued.after.some((once) => once !== null)) throw new Error("a base still names a queued edit")
  return queued.edit
}

export function landed(queue: readonly Queued[], once: string, rev: scene.Rev): Queued[] {
  const rest: Queued[] = []
  for (const each of queue) {
    if (each.edit.once === once) continue
    if (!each.after.includes(once)) {
      rest.push(each)
      continue
    }
    rest.push({
      edit: {
        ...each.edit,
        writes: each.edit.writes.map((write, index) => (each.after[index] === once ? { ...write, base: rev } : write)),
      },
      after: each.after.map((name) => (name === once ? null : name)),
    })
  }
  return rest
}

export function dropped(
  queue: readonly Queued[],
  once: string,
): { readonly queue: readonly Queued[]; readonly gone: readonly string[] } {
  if (!queue.some((each) => each.edit.once === once)) return { queue, gone: [] }
  const gone = new Set([once])
  for (const each of queue) if (each.after.some((name) => name !== null && gone.has(name))) gone.add(each.edit.once)
  return {
    queue: queue.filter((each) => !gone.has(each.edit.once)),
    gone: queue.filter((each) => gone.has(each.edit.once)).map((each) => each.edit.once),
  }
}
