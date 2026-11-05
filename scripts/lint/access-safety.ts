export type AccessSafetyHit = {
  line: number
  reason: string
}

export function accessSafetyHits(file: string, source: string): AccessSafetyHit[] {
  const hits: AccessSafetyHit[] = []
  const normalized = file.replaceAll("\\", "/")
  const lines = source.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    const secureOff = "useSecureCookies:" + " false"
    const secureOffTight = "useSecureCookies:" + "false"
    const pathDecode = "decodeURIComponent" + "("
    const dropSchema = "DROP " + "SCHEMA"
    if (line.includes(secureOff) || line.includes(secureOffTight)) {
      hits.push({ line: index + 1, reason: "secure-cookies-hardcoded-off" })
    }
    if (line.includes(pathDecode) && !normalized.endsWith("/decode-path-segment.ts")) {
      hits.push({ line: index + 1, reason: "unsafe-path-decode" })
    }
    if (line.includes(dropSchema) && !normalized.endsWith("/disposable-schema.ts")) {
      hits.push({ line: index + 1, reason: "drop-schema-outside-disposable" })
    }
    if (/^\s*void\s+serve\(/.test(line)) {
      hits.push({ line: index + 1, reason: "discarded-request" })
    }
  }
  return hits
}
