export function commonPrefix(left: Uint8Array, right: Uint8Array): number {
  let at = 0
  while (at < left.length && at < right.length && left[at] === right[at]) at += 1
  return at
}
