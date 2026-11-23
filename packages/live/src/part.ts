export function hex(buffer: ArrayBuffer): string {
  let text = ""
  for (const byte of new Uint8Array(buffer)) text += byte.toString(16).padStart(2, "0")
  return text
}

export function owned(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength))
  copy.set(bytes)
  return copy
}

export async function putPart(bytes: Uint8Array): Promise<string> {
  const payload = owned(bytes)
  const hash = hex(await crypto.subtle.digest("SHA-256", payload))
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(hash, { create: true })
  const writable = await handle.createWritable()
  await writable.write(payload)
  await writable.close()
  return hash
}

export async function getPart(hash: string): Promise<Uint8Array> {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(hash)
  const file = await handle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}
