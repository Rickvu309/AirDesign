import { fallbackFont, fontRoutes, servedFontAlias, type ServedFace } from "@airdesign/fonts"

const paintFontWait = 400
const outputFontWait = 10_000

async function beforeFontDeadline(work: Promise<boolean>, limit: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), limit)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function waitForPaintFonts(work: Promise<unknown>): Promise<void> {
  await beforeFontDeadline(
    work.then(() => true),
    paintFontWait,
  )
}

export type FontIssue = { readonly family: string; readonly refusal: "unknown" | "unavailable" }
type Face = ServedFace & { readonly url: string }
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

export type InstalledFace = {
  readonly family: string
  readonly url: string
  readonly style: string
  readonly weight: string
}

const installed = new WeakMap<Document, InstalledFace[]>()

export function installedFaces(doc: Document): readonly InstalledFace[] {
  return installed.get(doc) ?? []
}

async function installFonts(doc: Document, family: Manifest): Promise<void> {
  const alias = servedFontAlias(family.family)
  const faces = await Promise.all(
    family.faces.map(async (file) => {
      const face = new FontFace(alias, `url("${file.url}")`, { style: file.style, weight: file.weight })
      return face.load()
    }),
  )
  for (const face of faces) doc.fonts.add(face)
  const kept = installed.get(doc) ?? []
  for (const file of family.faces) kept.push({ family: alias, url: file.url, style: file.style, weight: file.weight })
  installed.set(doc, kept)
}

export class FontLoader {
  private readonly pending = new Map<string, Promise<FontIssue | null>>()
  private readonly settled = new Set<string>()
  private readonly failures = new Set<string>()
  private readonly watchers = new Set<() => void>()
  private readonly served = new Map<string, { readonly family: string; readonly faces: readonly ServedFace[] }>()
  private readonly doc: Document
  private readonly network: typeof fetch
  private readonly install: (family: Manifest) => Promise<void>

  constructor(
    doc: Document,
    network: typeof fetch = (...args) => fetch(...args),
    install = (family: Manifest) => installFonts(doc, family),
  ) {
    this.doc = doc
    this.network = network
    this.install = install
  }

  ready(name: string): boolean {
    return this.settled.has(name.toLowerCase())
  }

  pendingNames(): readonly string[] {
    return [...new Set([...this.pending.keys(), ...this.failures])].filter((name) => !this.settled.has(name))
  }

  failed(name: string): boolean {
    return this.failures.has(name.toLowerCase())
  }

  faces(name: string): readonly ServedFace[] | undefined {
    return this.served.get(name.toLowerCase())?.faces
  }

  servedFamily(name: string): string | undefined {
    return this.ready(name) ? this.served.get(name.toLowerCase())?.family : undefined
  }

  settledCount(): number {
    return this.settled.size
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

  async wait(names: readonly string[]): Promise<boolean> {
    const installed = async () => {
      const issues = await Promise.all(names.map((name) => this.load(name)))
      if (issues.some((issue) => issue?.refusal === "unavailable")) return false
      await this.doc.fonts?.ready
      return true
    }
    return beforeFontDeadline(installed(), outputFontWait)
  }

  load(name: string): Promise<FontIssue | null> {
    const key = name.toLowerCase()
    let pending = this.pending.get(key)
    if (pending !== undefined) return pending
    pending = this.register(name)
      .catch((): FontIssue => ({ family: name, refusal: "unavailable" }))
      .then((issue) => {
        if (issue?.refusal === "unavailable") {
          this.pending.delete(key)
          this.failures.add(key)
        } else {
          this.settled.add(key)
          this.failures.delete(key)
        }
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
    if (response.status === 404 && name.toLowerCase() !== fallbackFont.toLowerCase())
      return { family: name, refusal: "unknown" }
    if (!response.ok) throw new Error("font source")
    const raw: unknown = await response.json()
    if (!manifest(raw)) throw new Error("font manifest")
    const key = name.toLowerCase()
    this.served.set(key, { family: raw.family, faces: raw.faces.map(({ style, weight }) => ({ style, weight })) })
    await this.install(raw).catch((error: unknown) => {
      this.served.delete(key)
      throw error
    })
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
