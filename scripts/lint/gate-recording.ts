export type GateRecordingHit = {
  line: number
  reason: string
}

export function gateRecordingHits(file: string, source: string): GateRecordingHit[] {
  const normalized = file.replaceAll("\\", "/")
  if (normalized.includes("/scripts/evidence/") || normalized.startsWith("scripts/evidence/")) {
    return []
  }
  const gated = /\.(test|spec)\.[cm]?[jt]sx?$/.test(normalized)
    || /(^|\/)scripts\/verify-/.test(normalized)
    || /(^|\/)scripts\/measure-/.test(normalized)
  if (!gated) {
    return []
  }
  const hits: GateRecordingHit[] = []
  const lines = source.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    if (/(['"])record\1/.test(line) && (/(['"])start\1/.test(line) || line.includes("webm"))) {
      hits.push({ line: index + 1, reason: "video-recorded-in-gate" })
    }
  }
  return hits
}
