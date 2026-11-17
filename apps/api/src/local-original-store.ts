import {
  originalHeaders,
  originalLifetime,
  type OriginalStore,
  type OriginalUpload,
  type SignedOriginal,
} from "./original-store.js"

type Permit = {
  readonly key: string
  readonly method: "PUT" | "GET"
  readonly until: number
  readonly headers: Readonly<Record<string, string>>
}

export class LocalOriginalStore implements OriginalStore {
  readonly objects = new Map<string, Uint8Array>()
  private readonly permits = new Map<string, Permit>()
  private next = 0

  private readonly now: () => number
  private readonly base: string

  constructor(now: () => number = Date.now, base = "https://original.test") {
    this.now = now
    this.base = base
  }

  private signed(key: string, method: "PUT" | "GET", headers: Readonly<Record<string, string>>): OriginalUpload {
    const until = this.now() + originalLifetime
    const url = `${this.base}/${String(++this.next)}`
    this.permits.set(url, { key, method, until, headers })
    return { url, headers, expires: new Date(until).toISOString() }
  }

  async read(key: string): Promise<Uint8Array | undefined> {
    return this.objects.get(key)?.slice()
  }

  async write(key: string, bytes: Uint8Array): Promise<void> {
    if (!this.objects.has(key)) this.objects.set(key, bytes.slice())
  }

  async upload(key: string, bytes: number): Promise<OriginalUpload> {
    return this.signed(key, "PUT", originalHeaders(bytes))
  }

  async download(key: string): Promise<SignedOriginal> {
    const { url, expires } = this.signed(key, "GET", {})
    return { url, expires }
  }

  private permit(url: string, method: "PUT" | "GET"): Permit {
    const permit = this.permits.get(url)
    if (permit === undefined || permit.method !== method || this.now() >= permit.until) throw new Error("expired")
    return permit
  }

  put(url: string, bytes: Uint8Array, headers: Readonly<Record<string, string>>): void {
    const permit = this.permit(url, "PUT")
    if (Object.entries(permit.headers).some(([name, value]) => headers[name] !== value)) throw new Error("headers")
    if (bytes.byteLength !== Number(permit.headers["content-length"])) throw new Error("size")
    if (this.objects.has(permit.key)) throw new Error("present")
    this.objects.set(permit.key, bytes.slice())
  }

  get(url: string): Uint8Array {
    const permit = this.permit(url, "GET")
    const bytes = this.objects.get(permit.key)
    if (bytes === undefined) throw new Error("missing")
    return bytes.slice()
  }

  async size(key: string): Promise<number | undefined> {
    return this.objects.get(key)?.byteLength
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key)
  }
}
