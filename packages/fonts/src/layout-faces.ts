import * as hb from "harfbuzzjs/lazy"
import type { FaceAsset, LayoutFace } from "./layout-contract.js"

type Parsed = {
  readonly face: hb.Face
  readonly axes: ReturnType<hb.Face["getAxisInfos"]>
  readonly presentation: "text" | "color"
  readonly instances: Map<string, hb.Font>
}

type File = {
  readonly size: number
  readonly keys: Map<string, (() => void) | undefined>
  readonly parsed: Map<number, Parsed>
  readonly bytes: hb.Blob
}

const instanceLimit = 16
const readLimit = 3
const retryAfter = 60_000
class FontBudgetError extends Error {
  override readonly name = "FontBudgetError"
}

type FaceBytes = { readonly bytes: Uint8Array<ArrayBuffer>; readonly hash: string }

export class LayoutFaces {
  private readonly files = new Map<string, File>()
  private readonly hashes = new Map<string, string>()
  private readonly pending = new Map<string, Promise<FaceBytes>>()
  private readonly failures = new Map<string, { readonly count: number; readonly until: number }>()
  private readonly pins = new Map<string, Set<{ readonly priority: number }>>()
  private bytes = 0
  private evictions = 0
  private readonly budget: number

  private readonly hardCap: number

  constructor(budget: number, hardCap: number) {
    this.budget = budget
    this.hardCap = hardCap
  }

  pin(revision: string, key: string, priority = 0): () => void {
    const id = JSON.stringify([revision, key])
    let pins = this.pins.get(id)
    if (pins === undefined) this.pins.set(id, (pins = new Set()))
    const pin = { priority }
    pins.add(pin)
    return () => {
      pins.delete(pin)
      if (pins.size === 0) this.pins.delete(id)
    }
  }

  private priority(key: string): number {
    return Math.max(-1, ...[...(this.pins.get(key) ?? [])].map((pin) => pin.priority))
  }

  cache(): { readonly bytes: number; readonly faces: number; readonly evictions: number } {
    return { bytes: this.bytes, faces: this.files.size, evictions: this.evictions }
  }

  has(face: LayoutFace): boolean {
    return this.files.has(JSON.stringify([face.revision, face.sha256]))
  }

  private hold(id: string): File | undefined {
    const file = this.files.get(id)
    if (file !== undefined) {
      this.files.delete(id)
      this.files.set(id, file)
    }
    return file
  }

  private async read(asset: FaceAsset, key: string): Promise<FaceBytes> {
    const recent = this.failures.get(key)
    const failures = recent !== undefined && recent.until > Date.now() ? recent.count : 0
    if (failures >= readLimit) throw new Error("Served face reached its read limit")
    try {
      const bytes = await Promise.resolve().then(() => asset.read())
      if (bytes.byteLength === 0 || bytes.byteLength > this.hardCap)
        throw new FontBudgetError("Served face exceeds its byte budget")
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("")
      this.failures.delete(key)
      return { bytes, hash }
    } catch (error) {
      this.failures.set(key, { count: failures + 1, until: Date.now() + retryAfter })
      throw error
    }
  }

  private store(asset: FaceAsset, key: string, { bytes, hash }: FaceBytes): string {
    const id = JSON.stringify([asset.revision, hash])
    let file = this.hold(id)
    if (file === undefined) {
      const priority = this.priority(key)
      const limit = priority < 0 ? this.budget : this.hardCap
      const candidates = [...this.files]
        .map(([oldId, old]) => ({
          oldId,
          old,
          priority: Math.max(-1, ...[...old.keys.keys()].map((alias) => this.priority(alias))),
        }))
        .sort((a, b) => a.priority - b.priority)
      for (const { oldId, old, priority: pinned } of candidates) {
        if (pinned >= priority && pinned >= 0) break
        if (this.bytes + bytes.byteLength <= (pinned < 0 ? this.budget : limit)) break
        for (const parsed of old.parsed.values()) {
          for (const font of parsed.instances.values()) font.dispose()
          parsed.face.dispose()
        }
        old.bytes.dispose()
        this.files.delete(oldId)
        for (const [alias, onEvict] of old.keys) {
          this.hashes.delete(alias)
          onEvict?.()
        }
        this.bytes -= old.size
        this.evictions++
      }
      if (this.bytes + bytes.byteLength > limit) {
        asset.onEvict?.()
        throw new FontBudgetError("Pinned faces exceed the hard cap")
      }
      file = { size: bytes.byteLength, bytes: new hb.Blob(bytes), parsed: new Map(), keys: new Map() }
      this.files.set(id, file)
      this.bytes += bytes.byteLength
    }
    file.keys.set(key, asset.onEvict)
    this.hashes.set(key, hash)
    return hash
  }

  private parsed(revision: string, hash: string, index: number): Parsed | undefined {
    const file = this.hold(JSON.stringify([revision, hash]))
    if (file === undefined) return undefined
    let parsed = file.parsed.get(index)
    if (parsed === undefined) {
      const face = new hb.Face(file.bytes, index)
      const color = face.hasColorLayers() || face.hasColorPaint() || face.hasColorPng()
      parsed = { face, axes: face.getAxisInfos(), presentation: color ? "color" : "text", instances: new Map() }
      file.parsed.set(index, parsed)
    }
    return parsed
  }

  async prepare(asset: FaceAsset): Promise<LayoutFace> {
    const key = JSON.stringify([asset.revision, asset.key])
    let hash = this.hashes.get(key)
    if (hash === undefined) {
      let pending = this.pending.get(key)
      if (pending === undefined) {
        pending = this.read(asset, key)
        this.pending.set(key, pending)
      }
      try {
        hash = this.store(asset, key, await pending)
      } finally {
        if (this.pending.get(key) === pending) this.pending.delete(key)
      }
    }
    const faceIndex = asset.faceIndex ?? 0
    const parsed = this.parsed(asset.revision, hash, faceIndex)
    if (parsed === undefined) throw new Error("Served face was evicted during preparation")
    const axes = Object.fromEntries(
      Object.entries(asset.axes).flatMap(([tag, value]) => {
        const axis = parsed.axes[tag]
        return axis === undefined ? [] : [[tag, Math.min(axis.max, Math.max(axis.min, value))]]
      }),
    )
    return { revision: asset.revision, sha256: hash, faceIndex, axes, presentation: parsed.presentation }
  }

  font(face: LayoutFace): hb.Font | undefined {
    const parsed = this.parsed(face.revision, face.sha256, face.faceIndex)
    if (parsed === undefined) return undefined
    const axes = Object.entries(face.axes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    const key = JSON.stringify(axes)
    let instance = parsed.instances.get(key)
    if (instance === undefined) {
      instance = new hb.Font(parsed.face)
      instance.setVariations(axes.map(([tag, value]) => new hb.Variation(tag, value)))
      if (parsed.instances.size >= instanceLimit) {
        const oldest = parsed.instances.keys().next()
        if (!oldest.done) {
          parsed.instances.get(oldest.value)?.dispose()
          parsed.instances.delete(oldest.value)
        }
      }
    } else parsed.instances.delete(key)
    parsed.instances.set(key, instance)
    return instance
  }
}
