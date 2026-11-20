import { crc32 } from "./crc32.js"
import { encodeUtf8 } from "./package-bytes.js"
import {
  centralSignature,
  centralSize,
  endSize,
  localSignature,
  localSize,
  recordView,
  stored,
} from "./package-container.js"

const neededVersion = 20
const fixedDate = 0x21
const endSignature = 0x06054b50

export function storedZip(files: readonly (readonly [string, Uint8Array])[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, data] of files) {
    const nameBytes = encodeUtf8(name)
    const crc = crc32(data)
    const local = new Uint8Array(localSize + nameBytes.length + data.length)
    const head = recordView(local)
    head.setUint32(0, localSignature, true)
    head.setUint16(4, neededVersion, true)
    head.setUint16(8, stored, true)
    head.setUint16(12, fixedDate, true)
    head.setUint32(14, crc, true)
    head.setUint32(18, data.length, true)
    head.setUint32(22, data.length, true)
    head.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, localSize)
    local.set(data, localSize + nameBytes.length)
    const central = new Uint8Array(centralSize + nameBytes.length)
    const row = recordView(central)
    row.setUint32(0, centralSignature, true)
    row.setUint16(4, neededVersion, true)
    row.setUint16(6, neededVersion, true)
    row.setUint16(10, stored, true)
    row.setUint16(14, fixedDate, true)
    row.setUint32(16, crc, true)
    row.setUint32(20, data.length, true)
    row.setUint32(24, data.length, true)
    row.setUint16(28, nameBytes.length, true)
    row.setUint32(42, offset, true)
    central.set(nameBytes, centralSize)
    locals.push(local)
    centrals.push(central)
    offset += local.length
  }
  const directory = centrals.reduce((total, central) => total + central.length, 0)
  const whole = new Uint8Array(offset + directory + endSize)
  let at = 0
  for (const piece of [...locals, ...centrals]) {
    whole.set(piece, at)
    at += piece.length
  }
  const end = recordView(whole.subarray(at))
  end.setUint32(0, endSignature, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, directory, true)
  end.setUint32(16, offset, true)
  return whole
}
