import { fromBuffer } from "yauzl"
import { ZipFile } from "yazl"
import { crc32 } from "node:zlib"
import { fileLimits, safePartName } from "../../files/src/index.ts"

export async function readArchive(input: Buffer): Promise<Map<string, Buffer>> {
  if (input.length > fileLimits.compressed) throw new Error("zip-input-limit")
  return new Promise((resolve, reject) => {
    fromBuffer(input, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
      if (error || !zip) { reject(error ?? new Error("zip-invalid")); return }
      const parts = new Map<string, Buffer>()
      const names = new Set<string>()
      let expanded = 0
      let entries = 0
      const fail = (reason: unknown) => { zip.close(); reject(reason) }
      zip.on("error", fail)
      zip.on("end", () => resolve(parts))
      zip.on("entry", entry => {
        try {
          entries++
          if (entries > fileLimits.parts || entry.versionNeededToExtract >= 45 || entry.generalPurposeBitFlag & 1 || ![0,8].includes(entry.compressionMethod)) throw new Error("zip-format-or-part-limit")
          const directory = entry.fileName.endsWith("/")
          const name = directory ? entry.fileName.slice(0,-1) : entry.fileName
          if (!safePartName(name) || names.has(name.toLowerCase()) || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error("zip-unsafe-or-duplicate-path")
          names.add(name.toLowerCase())
          if (directory) { zip.readEntry(); return }
          const limit = /\.(xml|rels)$/i.test(name) ? fileLimits.xml : fileLimits.binary
          if (entry.uncompressedSize > limit || entry.uncompressedSize > Math.max(entry.compressedSize,1) * fileLimits.ratio || expanded + entry.uncompressedSize > fileLimits.expanded) throw new Error("zip-expansion-limit")
          zip.openReadStream(entry, (streamError, stream) => {
            if (streamError || !stream) { fail(streamError ?? new Error("zip-stream")); return }
            const chunks: Buffer[] = []
            let size = 0
            stream.on("error", fail)
            stream.on("data", (chunk: Buffer) => {
              size += chunk.length
              expanded += chunk.length
              if (size > limit || expanded > fileLimits.expanded || size > Math.max(entry.compressedSize,1) * fileLimits.ratio) { stream.destroy(new Error("zip-actual-expansion-limit")); return }
              chunks.push(chunk)
            })
            stream.on("end", () => {
              const data = Buffer.concat(chunks)
              if (data.length !== entry.uncompressedSize || crc32(data) !== entry.crc32) { fail(new Error("zip-size-or-crc")); return }
              parts.set(name, data)
              zip.readEntry()
            })
          })
        } catch (reason) { fail(reason) }
      })
      zip.readEntry()
    })
  })
}

export async function writeArchive(parts: ReadonlyMap<string, Buffer>): Promise<Buffer> {
  const zip = new ZipFile()
  const chunks: Buffer[] = []
  const result = new Promise<Buffer>((resolve, reject) => {
    zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk))
    zip.outputStream.on("error", reject)
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)))
  })
  for (const [name, data] of parts) {
    if (!safePartName(name)) throw new Error("zip-unsafe-output-path")
    zip.addBuffer(data, name, { compress: false, mtime: new Date("2020-01-01T00:00:00Z") })
  }
  zip.end()
  return result
}
