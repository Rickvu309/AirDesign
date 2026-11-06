export type MutationRejection = { status: 403; code: "origin-rejected" } | { status: 415; code: "content-type-rejected" }

export function mutationRejection(request: Request, publicOrigin: string, mediaTypes: readonly string[] = ["application/json"]): MutationRejection | null {
  if (request.method === "GET" || request.method === "HEAD") {
    return null
  }
  const media = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? ""
  if (!mediaTypes.includes(media)) {
    return { status: 415, code: "content-type-rejected" }
  }
  const origin = request.headers.get("origin")
  if (origin === null) {
    return null
  }
  let trusted = ""
  try {
    trusted = new URL(publicOrigin).origin
  } catch {
    return { status: 403, code: "origin-rejected" }
  }
  if (origin !== trusted) {
    return { status: 403, code: "origin-rejected" }
  }
  return null
}
