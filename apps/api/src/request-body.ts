import type { IncomingMessage } from "node:http"

async function readBody(req: IncomingMessage, cap: number): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size <= cap) chunks.push(buffer)
  }
  return size > cap ? undefined : Buffer.concat(chunks)
}

export function bodyOnce(req: IncomingMessage, cap: number): () => Promise<Buffer | undefined> {
  let read: Promise<Buffer | undefined> | undefined
  return () => (read ??= readBody(req, cap))
}
