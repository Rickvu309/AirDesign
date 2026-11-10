import zlib from "node:zlib"

const utf8Names = 0x0800
const firstDosDate = 0x21

const entryHeader = (signature, lead, name, data, tail) => {
  const header = Buffer.alloc(lead + 24 + tail)
  header.writeUInt32LE(signature, 0)
  for (let at = 4; at < lead; at += 2) header.writeUInt16LE(20, at)
  header.writeUInt16LE(utf8Names, lead)
  header.writeUInt16LE(firstDosDate, lead + 6)
  header.writeUInt32LE(zlib.crc32(data), lead + 8)
  header.writeUInt32LE(data.length, lead + 12)
  header.writeUInt32LE(data.length, lead + 16)
  header.writeUInt16LE(name.length, lead + 20)
  return header
}

export const storedZip = (parts) => {
  const files = []
  const directory = []
  let offset = 0
  for (const [partName, data] of parts) {
    const name = Buffer.from(partName, "utf8")
    const local = entryHeader(0x04034b50, 6, name, data, 0)
    const listed = entryHeader(0x02014b50, 8, name, data, 14)
    listed.writeUInt32LE(offset, 42)
    files.push(local, name, data)
    directory.push(listed, name)
    offset += local.length + name.length + data.length
  }
  const listing = Buffer.concat(directory)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(parts.size, 8)
  end.writeUInt16LE(parts.size, 10)
  end.writeUInt32LE(listing.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...files, listing, end])
}
