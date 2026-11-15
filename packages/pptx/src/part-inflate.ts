const longestCode = 15
const fastBits = 9
const fastSize = 1 << fastBits
const lengthSymbols = 286
const distanceSymbols = 30
const endOfBlock = 256
const lengthOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]
const lengthBase = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
]
const lengthExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
const distanceBase = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577,
]
const distanceExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]

class InflateFault extends Error {}

type Code = { readonly count: Uint16Array; readonly symbol: Uint16Array; readonly fast: Int32Array }

function reversed(value: number, width: number): number {
  let result = 0
  for (let bit = 0; bit < width; bit += 1) result |= ((value >>> bit) & 1) << (width - 1 - bit)
  return result
}

function built(lengths: Uint8Array, completeOnly: boolean): Code {
  const count = new Uint16Array(longestCode + 1)
  for (const length of lengths) count[length] = (count[length] ?? 0) + 1
  const symbol = new Uint16Array(lengths.length)
  const fast = new Int32Array(fastSize)
  const zeros = count[0] ?? 0
  if (zeros === lengths.length) return { count, symbol, fast }
  let left = 1
  for (let length = 1; length <= longestCode; length += 1) {
    left = (left << 1) - (count[length] ?? 0)
    if (left < 0) throw new InflateFault()
  }
  if (left > 0 && (completeOnly || zeros + (count[1] ?? 0) !== lengths.length)) throw new InflateFault()
  const offset = new Uint16Array(longestCode + 2)
  for (let length = 1; length <= longestCode; length += 1)
    offset[length + 1] = (offset[length] ?? 0) + (count[length] ?? 0)
  const next = new Uint16Array(longestCode + 1)
  let code = 0
  for (let length = 1; length <= longestCode; length += 1) {
    next[length] = code
    code = (code + (count[length] ?? 0)) << 1
  }
  lengths.forEach((length, value) => {
    if (length === 0) return
    const at = offset[length] ?? 0
    offset[length] = at + 1
    symbol[at] = value
    const assigned = next[length] ?? 0
    next[length] = assigned + 1
    if (length > fastBits) return
    for (let index = reversed(assigned, length); index < fastSize; index += 1 << length)
      fast[index] = (value << 4) | length
  })
  return { count, symbol, fast }
}

function fixedCodes(): readonly [Code, Code] {
  const lengths = new Uint8Array(288)
  lengths.fill(8, 0, 144)
  lengths.fill(9, 144, 256)
  lengths.fill(7, 256, 280)
  lengths.fill(8, 280, 288)
  return [built(lengths, false), built(new Uint8Array(32).fill(5), false)]
}

const [fixedLengths, fixedDistances] = fixedCodes()

class Inflater {
  private at = 0
  private bits = 0
  private held = 0
  private written = 0
  private readonly input: Uint8Array
  private readonly output: Uint8Array

  constructor(input: Uint8Array, size: number) {
    this.input = input
    this.output = new Uint8Array(size)
  }

  private need(width: number): void {
    while (this.held < width) {
      if (this.at >= this.input.length) throw new InflateFault()
      this.bits |= (this.input[this.at] ?? 0) << this.held
      this.at += 1
      this.held += 8
    }
  }

  private take(width: number): number {
    this.need(width)
    const value = this.bits & ((1 << width) - 1)
    this.bits >>>= width
    this.held -= width
    return value
  }

  private decode(code: Code): number {
    while (this.held < longestCode && this.at < this.input.length) {
      this.bits |= (this.input[this.at] ?? 0) << this.held
      this.at += 1
      this.held += 8
    }
    const entry = code.fast[this.bits & (fastSize - 1)] ?? 0
    const width = entry & 15
    if (entry !== 0 && width <= this.held) {
      this.bits >>>= width
      this.held -= width
      return entry >>> 4
    }
    let value = 0
    let first = 0
    let index = 0
    for (let length = 1; length <= longestCode && length <= this.held; length += 1) {
      value |= (this.bits >>> (length - 1)) & 1
      const count = code.count[length] ?? 0
      if (value - count < first) {
        this.bits >>>= length
        this.held -= length
        return code.symbol[index + value - first] ?? 0
      }
      index += count
      first = (first + count) << 1
      value <<= 1
    }
    throw new InflateFault()
  }

  private stored(): void {
    this.bits >>>= this.held & 7
    this.held -= this.held & 7
    this.at -= this.held >>> 3
    this.bits = 0
    this.held = 0
    const { input, at } = this
    if (at + 4 > input.length) throw new InflateFault()
    const length = (input[at] ?? 0) | ((input[at + 1] ?? 0) << 8)
    const check = (input[at + 2] ?? 0) | ((input[at + 3] ?? 0) << 8)
    if (length !== (~check & 0xffff)) throw new InflateFault()
    const start = at + 4
    if (start + length > input.length || this.written + length > this.output.length) throw new InflateFault()
    this.output.set(input.subarray(start, start + length), this.written)
    this.written += length
    this.at = start + length
  }

  private dynamicCodes(): readonly [Code, Code] {
    const lengthCount = this.take(5) + 257
    const distanceCount = this.take(5) + 1
    const orderCount = this.take(4) + 4
    if (lengthCount > lengthSymbols || distanceCount > distanceSymbols) throw new InflateFault()
    const orderLengths = new Uint8Array(19)
    for (let index = 0; index < orderCount; index += 1) orderLengths[lengthOrder[index] ?? 0] = this.take(3)
    const orderCode = built(orderLengths, true)
    const lengths = new Uint8Array(lengthCount + distanceCount)
    let index = 0
    while (index < lengths.length) {
      const symbol = this.decode(orderCode)
      if (symbol < 16) {
        lengths[index] = symbol
        index += 1
        continue
      }
      let repeated = 0
      let times: number
      if (symbol === 16) {
        if (index === 0) throw new InflateFault()
        repeated = lengths[index - 1] ?? 0
        times = 3 + this.take(2)
      } else if (symbol === 17) {
        times = 3 + this.take(3)
      } else {
        times = 11 + this.take(7)
      }
      if (index + times > lengths.length) throw new InflateFault()
      lengths.fill(repeated, index, index + times)
      index += times
    }
    if (lengths[endOfBlock] === 0) throw new InflateFault()
    return [built(lengths.subarray(0, lengthCount), false), built(lengths.subarray(lengthCount), false)]
  }

  private block(lengths: Code, distances: Code): void {
    const { output } = this
    for (;;) {
      const symbol = this.decode(lengths)
      if (symbol < endOfBlock) {
        if (this.written >= output.length) throw new InflateFault()
        output[this.written] = symbol
        this.written += 1
        continue
      }
      if (symbol === endOfBlock) return
      const lengthIndex = symbol - 257
      if (lengthIndex >= lengthBase.length) throw new InflateFault()
      const length = (lengthBase[lengthIndex] ?? 0) + this.take(lengthExtra[lengthIndex] ?? 0)
      const distanceIndex = this.decode(distances)
      if (distanceIndex >= distanceSymbols) throw new InflateFault()
      const distance = (distanceBase[distanceIndex] ?? 0) + this.take(distanceExtra[distanceIndex] ?? 0)
      if (distance > this.written || this.written + length > output.length) throw new InflateFault()
      let from = this.written - distance
      const end = this.written + length
      for (let to = this.written; to < end; to += 1) {
        output[to] = output[from] ?? 0
        from += 1
      }
      this.written = end
    }
  }

  run(): Uint8Array {
    let last = 0
    while (last === 0) {
      last = this.take(1)
      const kind = this.take(2)
      if (kind === 0) this.stored()
      else if (kind === 1) this.block(fixedLengths, fixedDistances)
      else if (kind === 2) this.block(...this.dynamicCodes())
      else throw new InflateFault()
    }
    if (this.written !== this.output.length || this.held >= 8 || this.at !== this.input.length) throw new InflateFault()
    return this.output
  }
}

export function inflate(stream: Uint8Array, size: number): Uint8Array | undefined {
  try {
    return new Inflater(stream, size).run()
  } catch (error) {
    if (error instanceof InflateFault) return undefined
    throw error
  }
}
