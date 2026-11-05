import type { IncomingMessage } from "node:http"
import { fileLimits } from "./index.ts"
export class RequestBodyLimit extends Error {}
export function readRequestBody(request: IncomingMessage, limit = Math.ceil(fileLimits.compressed / 3) * 4 + 1000): Promise<Buffer> {
  return new Promise((resolve,reject) => {
    const chunks: Buffer[] = []
    let bytes = 0
    const receive = (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > limit) {
        request.off("data",receive)
        request.resume()
        reject(new RequestBodyLimit("request-body-limit"))
        return
      }
      chunks.push(chunk)
    }
    request.on("data",receive)
    request.once("end",() => resolve(Buffer.concat(chunks)))
    request.once("error",reject)
    request.once("aborted",() => reject(new Error("request-aborted")))
  })
}
