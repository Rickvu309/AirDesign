export type HeaderHit = {
  line: number
  reason: string
}

const appendHeaderCall = new RegExp("\\." + "appendHeader" + "\\s*\\(")

export function responseHeaderHits(source: string): HeaderHit[] {
  const hits: HeaderHit[] = []
  const lines = source.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    if (appendHeaderCall.test(lines[index] ?? "")) {
      hits.push({ line: index + 1, reason: "append-header-after-send" })
    }
  }
  if(source.includes("response.writeHead(outgoing.status, headers)") && !source.includes('headers["cache-control"] = "no-store"'))hits.push({line:1,reason:"api-responses-require-no-store-for-deck-restore"})
  return hits
}
