const lanes = 8

const crcTable = new Uint32Array(lanes * 256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  crcTable[index] = value >>> 0
}
for (let at = 256; at < crcTable.length; at += 1) {
  const previous = crcTable[at - 256] ?? 0
  crcTable[at] = (crcTable[previous & 0xff] ?? 0) ^ (previous >>> 8)
}

const entry = (lane: number, byte: number) => crcTable[lane * 256 + byte] ?? 0

export function crc32(data: Uint8Array): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const whole = data.length - (data.length % lanes)
  let crc = 0xffffffff
  let at = 0
  for (; at < whole; at += lanes) {
    const low = crc ^ view.getUint32(at, true)
    const high = view.getUint32(at + 4, true)
    crc =
      entry(7, low & 0xff) ^
      entry(6, (low >>> 8) & 0xff) ^
      entry(5, (low >>> 16) & 0xff) ^
      entry(4, low >>> 24) ^
      entry(3, high & 0xff) ^
      entry(2, (high >>> 8) & 0xff) ^
      entry(1, (high >>> 16) & 0xff) ^
      entry(0, high >>> 24)
  }
  for (; at < data.length; at += 1) crc = entry(0, (crc ^ (data[at] ?? 0)) & 0xff) ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
