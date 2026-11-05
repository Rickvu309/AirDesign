export function operationSafetyHits(file: string, source: string): { line: number; reason: string }[] {
  if (!file.replaceAll("\\","/").includes("apps/server/src/")) return []
  return source.split("\n").flatMap((line,index) => /request\.on\(["']data["']/.test(line) ? [{ line: index+1, reason: "unbounded-request-stream-use-readRequestBody" }] : [])
}
