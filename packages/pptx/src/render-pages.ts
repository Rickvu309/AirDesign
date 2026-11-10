export type PageChange = {
  readonly changed: readonly number[]
  readonly removed: readonly number[]
}

function sameSet(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) return false
  const first = [...left].sort((a, b) => a - b)
  const second = [...right].sort((a, b) => a - b)
  return first.every((page, index) => page === second[index])
}

export function pageChange(before: readonly string[], after: readonly string[]): PageChange | null {
  const left = before.map((_, index) => index)
  const right = after.map((_, index) => index)
  let removed: number[] = []
  if (right.length === left.length - 1) {
    let found = false
    for (let index = 0; index < right.length; index += 1) {
      const leftAt = left[index]
      const rightAt = right[index]
      if (leftAt === undefined || rightAt === undefined) return null
      if (before[leftAt] !== after[rightAt]) {
        const dropped = left.splice(index, 1)[0]
        if (dropped === undefined) return null
        removed = [dropped + 1]
        found = true
        break
      }
    }
    if (!found) {
      const dropped = left.pop()
      if (dropped === undefined) return null
      removed = [dropped + 1]
    }
  }
  if (left.length !== right.length) return null
  const changed: number[] = []
  for (let index = 0; index < left.length; index += 1) {
    const leftAt = left[index]
    const rightAt = right[index]
    if (leftAt === undefined || rightAt === undefined) return null
    if (before[leftAt] !== after[rightAt]) changed.push(leftAt + 1)
  }
  return { changed, removed }
}

export function exactPageCheck(input: {
  readonly before: readonly string[]
  readonly after: readonly string[]
  readonly targeted: readonly number[]
  readonly visible: boolean
}): boolean {
  const change = pageChange(input.before, input.after)
  if (change === null) return false
  const affected = [...change.changed, ...change.removed]
  if (!input.visible) return affected.length === 0
  return sameSet(affected, input.targeted)
}
