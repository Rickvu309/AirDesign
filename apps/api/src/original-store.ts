export type SignedOriginal = {
  readonly url: string
  readonly expires: string
}

export type OriginalUpload = SignedOriginal & { readonly headers: Readonly<Record<string, string>> }

export interface OriginalStore {
  read(key: string): Promise<Uint8Array | undefined>
  write(key: string, bytes: Uint8Array): Promise<void>
  upload(key: string, bytes: number): Promise<OriginalUpload>
  download(key: string): Promise<SignedOriginal>
  size(key: string): Promise<number | undefined>
  delete(key: string): Promise<void>
}

export const originalLifetime = 15 * 60 * 1000

export function originalHeaders(bytes: number): Readonly<Record<string, string>> {
  return { "content-length": String(bytes), "if-none-match": "*" }
}
