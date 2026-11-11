import { AwsClient } from "aws4fetch"

import {
  originalHeaders,
  originalLifetime,
  type OriginalStore,
  type OriginalUpload,
  type SignedOriginal,
} from "./original-store.js"

export type R2Settings = {
  readonly accountId: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly bucket: string
}

export class R2OriginalStore implements OriginalStore {
  private readonly signer: AwsClient
  private readonly settings: R2Settings
  private readonly now: () => number

  constructor(settings: R2Settings, now: () => number = Date.now) {
    this.settings = settings
    this.now = now
    this.signer = new AwsClient({ ...settings, service: "s3", region: "auto", retries: 0 })
  }

  private address(key: string): string {
    return `https://${this.settings.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(this.settings.bucket)}/${key.split("/").map(encodeURIComponent).join("/")}`
  }

  private async signed(
    key: string,
    method: string,
    headers: Readonly<Record<string, string>>,
  ): Promise<SignedOriginal> {
    const now = this.now()
    const url = new URL(this.address(key))
    url.searchParams.set("X-Amz-Expires", String(originalLifetime / 1000))
    const request = await this.signer.sign(url, {
      method,
      headers,
      aws: { signQuery: true, allHeaders: true, datetime: new Date(now).toISOString().replace(/[:-]|\.\d{3}/g, "") },
    })
    return { url: request.url, expires: new Date(now + originalLifetime).toISOString() }
  }

  async upload(key: string, bytes: number): Promise<OriginalUpload> {
    const headers = originalHeaders(bytes)
    return { ...(await this.signed(key, "PUT", headers)), headers }
  }

  async download(key: string): Promise<SignedOriginal> {
    return this.signed(key, "GET", {})
  }

  async size(key: string): Promise<number | undefined> {
    const response = await this.signer.fetch(this.address(key), { method: "HEAD", signal: AbortSignal.timeout(10_000) })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error("storage")
    const length = response.headers.get("content-length")
    if (length === null || !/^\d+$/.test(length)) throw new Error("storage")
    const bytes = Number(length)
    if (!Number.isSafeInteger(bytes)) throw new Error("storage")
    return bytes
  }

  async delete(key: string): Promise<void> {
    const response = await this.signer.fetch(this.address(key), {
      method: "DELETE",
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok && response.status !== 404) throw new Error("storage")
  }
}
