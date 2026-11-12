export const limits = {
  decks: null,
  slides: 50,
  bytes: 70_000_000,
  valueBytes: 8_000,
  elements: 5_000,
  body: 1_000_000,
  form: 16_384,
  batch: 100,
  notify: 8_000,
  name: 200,
  delete: 100,
  clientName: 200,
  address: 2_000,
  row: 65_536,
} as const

const outsideAscii = /[^\u0000-\u007f]/

export function bytesOf(value: string): number {
  if (!outsideAscii.test(value)) return value.length
  let size = 0
  for (let at = 0; at < value.length; at += 1) {
    const code = value.charCodeAt(at)
    if (code <= 0x7f) size += 1
    else if (code <= 0x7ff) size += 2
    else if (code >= 0xd800 && code <= 0xdbff && at + 1 < value.length) {
      const next = value.charCodeAt(at + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        size += 4
        at += 1
      } else size += 3
    } else size += 3
  }
  return size
}

export function overLimit(count: { readonly decks: number; readonly slides: number; readonly bytes: number }): boolean {
  const deckLimit: number | null = limits.decks
  if (deckLimit !== null && count.decks > deckLimit) {
    return true
  }
  if (count.slides > limits.slides) {
    return true
  }
  return count.bytes >= limits.bytes
}
