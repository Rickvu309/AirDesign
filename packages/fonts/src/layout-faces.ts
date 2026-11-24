import * as hb from "harfbuzzjs"
import type { FaceAsset, LayoutFace } from "./layout-contract.js"

type Parsed = {
  readonly face: hb.Face
  readonly axes: ReturnType<hb.Face["getAxisInfos"]>
  readonly presentation: "text" | "color"
  readonly instances: Map<string, hb.Font>
}

type File = {
  readonly size: number
  readonly keys: Set<string>
  readonly parsed: Map<number, Parsed>
  readonly bytes: hb.Blob
}

const instanceLimit = 16

export class LayoutFaces {
  private readonly files = new Map<string, File>()
  private readonly hashes = new Map<string, string>()
  private readonly pending = new Map<string, Promise<string>>()
  private tail: Promise<unknown> = Promise.resolve()
  private bytes = 0
  private evictions = 0
  private readonly budget: number

  constructor(budget: number) {
    this.budget = budget
  }

  cache(): { readonly bytes: number; readonly faces: number; readonly evictions: number } {
    return { bytes: this.bytes, faces: this.files.size, evictions: this.evictions }
  }

  private hold(id: string): File | undefined {
    const file = this.files.get(id)
    if (file !== undefined) {
      this.files.delete(id)
      this.files.set(id, file)
    }
    return file
  }

  private async load(asset: FaceAsset, key: string): Promise<string> {
    const bytes = await asset.read()
    if (bytes.byteLength === 0 || bytes.byteLength > this.budget) throw new Error("Served face exceeds its byte budget")
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
    const id = JSON.stringify([asset.revision, hash])
    let file = this.hold(id)
    if (file === undefined) {
      for (const [oldId, old] of this.files) {
        if (this.bytes + bytes.byteLength <= this.budget) break
        for (const parsed of old.parsed.values()) {
          for (const font of parsed.instances.values()) font.dispose()
          parsed.face.dispose()
        }
        old.bytes.dispose()
        this.files.delete(oldId)
        for (const alias of old.keys) this.hashes.delete(alias)
        this.bytes -= old.size
        this.evictions++
      }
      file = { size: bytes.byteLength, bytes: new hb.Blob(bytes), parsed: new Map(), keys: new Set() }
      this.files.set(id, file)
      this.bytes += bytes.byteLength
    }
    file.keys.add(key)
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
        pending = this.tail.then(() => this.hashes.get(key) ?? this.load(asset, key))
        this.pending.set(key, pending)
        this.tail = pending.then(
          () => this.pending.delete(key),
          () => this.pending.delete(key),
        )
      }
      hash = await pending
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
