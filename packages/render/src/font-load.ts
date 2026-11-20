import { fontRoutes } from "@airdesign/fonts"

export type FontIssue = { readonly family: string; readonly refusal: "unknown" | "unavailable" }
type Face = { readonly url: string; readonly style: string; readonly weight: string }
type Manifest = { readonly ok: true; readonly family: string; readonly faces: readonly Face[] }

function manifest(raw: unknown): raw is Manifest {
  if (
    typeof raw !== "object" ||
    raw === null ||
    !("ok" in raw) ||
    raw.ok !== true ||
    !("family" in raw) ||
    typeof raw.family !== "string" ||
    !("faces" in raw) ||
    !Array.isArray(raw.faces)
  )
    return false
  return (
    raw.faces.length > 0 &&
    raw.faces.every(
      (face: unknown) =>
        typeof face === "object" &&
        face !== null &&
        "url" in face &&
        typeof face.url === "string" &&
        face.url.startsWith(`${fontRoutes.file.path}?`) &&
        "style" in face &&
        (face.style === "normal" || face.style === "italic") &&
        "weight" in face &&
        typeof face.weight === "string" &&
        /^\d+( \d+)?$/.test(face.weight),
    )
  )
}

async function installFonts(doc: Document, family: Manifest): Promise<void> {
  const faces = await Promise.all(
    family.faces.map(async (file) => {
      const face = new FontFace(family.family, `url("${file.url}")`, { style: file.style, weight: file.weight })
      return face.load()
    }),
  )
  for (const face of faces) doc.fonts.add(face)
}

export class FontLoader {
  private readonly pending = new Map<string, Promise<FontIssue | null>>()
  private readonly settled = new Set<string>()
  private readonly watchers = new Set<() => void>()
  private readonly network: typeof fetch
  private readonly install: (family: Manifest) => Promise<void>

  constructor(
    doc: Document,
    network: typeof fetch = (...args) => fetch(...args),
    install = (family: Manifest) => installFonts(doc, family),
  ) {
    this.network = network
    this.install = install
  }

  ready(name: string): boolean {
    return this.settled.has(name.toLowerCase())
  }

  busy(): boolean {
    return this.pending.size > this.settled.size
  }

  subscribe(watcher: () => void): () => void {
    this.watchers.add(watcher)
    return () => {
      this.watchers.delete(watcher)
    }
  }

  async wait(): Promise<void> {
    await Promise.all(this.pending.values())
  }

  load(name: string): Promise<FontIssue | null> {
    const key = name.toLowerCase()
    let pending = this.pending.get(key)
    if (pending !== undefined) return pending
    pending = this.register(name)
      .catch((): FontIssue => ({ family: name, refusal: "unavailable" }))
      .then((issue) => {
        this.settled.add(key)
        this.tell()
        return issue
      })
    this.pending.set(key, pending)
    this.tell()
    return pending
  }

  private tell(): void {
    for (const watcher of this.watchers) watcher()
  }

  private async register(name: string): Promise<FontIssue | null> {
    const response = await this.network(`${fontRoutes.family.path}?family=${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(45_000),
    })
    if (response.status === 404) return { family: name, refusal: "unknown" }
    if (!response.ok) throw new Error("font source")
    const raw: unknown = await response.json()
    if (!manifest(raw)) throw new Error("font manifest")
    await this.install(raw)
    return null
  }
}

const loaders = new WeakMap<Document, FontLoader>()
export function fontsFor(doc: Document): FontLoader | undefined {
  if (typeof FontFace === "undefined" || doc.fonts === undefined) return undefined
  let loader = loaders.get(doc)
  if (loader === undefined) {
    loader = new FontLoader(doc)
    loaders.set(doc, loader)
  }
  return loader
}

export async function waitForFonts(doc: Document): Promise<void> {
  await fontsFor(doc)?.wait()
  await doc.fonts?.ready
}
