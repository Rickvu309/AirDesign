import { readFile } from "node:fs/promises"
import {
  portableFace,
  fontFaces,
  fontRevision,
  fontRoutes,
  resolveFont,
  type FontFamily,
  type FontFile,
} from "@airdesign/fonts"
import type { OriginalStore } from "./original-store.js"

const upstream = `https://raw.githubusercontent.com/google/fonts/${fontRevision}`
const prefix = `fonts/${fontRevision}`
const maximumFile = 32 * 1024 * 1024
const localFaces: readonly FontFile[] = [
  { file: "LiberationSansNarrow-Regular.ttf", style: "normal", weight: "400" },
  { file: "LiberationSansNarrow-Italic.ttf", style: "italic", weight: "400" },
  { file: "LiberationSansNarrow-Bold.ttf", style: "normal", weight: "700" },
  { file: "LiberationSansNarrow-BoldItalic.ttf", style: "italic", weight: "700" },
]

export class FontSource {
  private readonly pending = new Map<string, Promise<readonly FontFile[]>>()
  private readonly store: OriginalStore | undefined
  private readonly network: typeof fetch

  constructor(store: OriginalStore | undefined, network: typeof fetch = fetch) {
    this.store = store
    this.network = network
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    const response = await this.network(url, { ...init, signal: AbortSignal.timeout(30_000), redirect: "error" })
    if (!response.ok) throw new Error("font download")
    return response
  }

  private async bytes(response: Response): Promise<Buffer> {
    const chunks: Uint8Array[] = []
    let size = 0
    for await (const chunk of response.body ?? []) {
      size += chunk.length
      if (size > maximumFile) throw new Error("font size")
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  private key(family: FontFamily, file: string): string {
    return `${prefix}/${family.folder}/${file}`
  }

  private async asset(family: FontFamily, file: string): Promise<Buffer> {
    if (family.folder === "local" || file === "Tinos-LICENSE.txt")
      return readFile(new URL(`../fonts/${file}`, import.meta.url))
    const key = this.key(family, file)
    if (this.store === undefined) throw new Error("font storage")
    const stored = await this.store.read(key)
    if (stored !== undefined) return Buffer.from(stored)
    const bytes = await this.bytes(await this.request(`${upstream}/${family.folder}/${encodeURIComponent(file)}`))
    await this.store.write(key, bytes)
    return bytes
  }

  private async prepare(family: FontFamily): Promise<readonly FontFile[]> {
    if (family.folder === "local") return localFaces
    const metadata = (await this.asset(family, "METADATA.pb")).toString("utf8")
    const faces = fontFaces(family, metadata)
    await this.asset(family, family.notice)
    for (const face of faces) await this.asset(family, face.file)
    return faces
  }

  private ready(family: FontFamily): Promise<readonly FontFile[]> {
    let pending = this.pending.get(family.family)
    if (pending !== undefined) return pending
    pending = this.prepare(family).catch((error: unknown) => {
      this.pending.delete(family.family)
      throw error
    })
    this.pending.set(family.family, pending)
    return pending
  }

  async family(name: string) {
    const family = resolveFont(name)
    if (family === undefined) return { ok: false, refusal: "unknown", family: name } as const
    const faces = await this.ready(family)
    const url = (file: string) =>
      `${fontRoutes.file.path}?family=${encodeURIComponent(family.family)}&file=${encodeURIComponent(file)}&v=${fontRevision}`
    const portable = portableFace(name)
    const chosen =
      portable === undefined
        ? faces
        : faces
            .filter((face) => face.file === portable.file || face.file === portable.italic)
            .map((face) => ({ ...face, weight: "400" }))
    return {
      ok: true,
      family: portable?.typeface ?? family.family,
      license: family.license,
      notice: url(family.notice),
      faces: chosen.map((face) => ({ ...face, url: url(face.file) })),
    } as const
  }

  async file(name: string, file: string): Promise<Buffer | undefined> {
    const family = resolveFont(name)
    if (family === undefined) return undefined
    const faces = await this.ready(family)
    if (file !== family.notice && !faces.some((face) => face.file === file)) return undefined
    return this.asset(family, file)
  }
}
