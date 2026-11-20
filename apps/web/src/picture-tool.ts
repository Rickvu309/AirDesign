import type { Register } from "@airdesign/document"
import { readMedia } from "@airdesign/live"
import { useEffect, useRef, useState } from "react"
import { missingPictures, type PictureBytes } from "@/exported-parts"
import { iconBytes, missingIcons } from "@/icon-fallback"
import { readPicture, type PictureFile, type PictureRefusal } from "@/picture-add"
import type { ThinNotice } from "@/thin-notice"

type Parts = ReadonlyMap<string, Uint8Array>

export type PictureStore = {
  readonly bytes: PictureBytes
  load(deck: string, register: Register | null, painted?: Parts): Promise<boolean>
  keep(sha256: string, bytes: Uint8Array): void
}

export class PicturesUploading extends Error {
  constructor() {
    super("pictures")
    this.name = "PicturesUploading"
  }
}

async function loadIcons(painted: Parts, bytes: Map<string, Uint8Array>, made: typeof iconBytes): Promise<boolean> {
  let more = false
  for (const icon of missingIcons(painted, bytes)) {
    const found = await made(icon)
    for (const [part, each] of found ?? []) bytes.set(part, each)
    more ||= found !== null
  }
  return more
}

export function pictureStore(read: typeof readMedia = readMedia, made: typeof iconBytes = iconBytes): PictureStore {
  const bytes = new Map<string, Uint8Array>()
  return {
    bytes,
    async load(deck, register, painted) {
      const icons = painted === undefined ? false : await loadIcons(painted, bytes, made)
      if (register === null) return icons
      const missing = missingPictures(register, bytes)
      if (missing.length === 0) return icons
      const found = await read(deck, missing)
      for (const [sha256, each] of found) bytes.set(sha256, each)
      return icons || found.size > 0
    },
    keep(sha256, each) {
      bytes.set(sha256, each)
    },
  }
}

export async function exportablePictures(store: PictureStore, deck: string, register: Register): Promise<PictureBytes> {
  await store.load(deck, register)
  if (missingPictures(register, store.bytes).length > 0) throw new PicturesUploading()
  return store.bytes
}

export async function withIcons(
  store: PictureStore,
  deck: string,
  register: Register,
  painted: (bytes: PictureBytes) => Parts,
): Promise<Parts> {
  const first = painted(store.bytes)
  if (!(await store.load(deck, register, first))) return first
  const next = painted(store.bytes)
  if (missingIcons(next, store.bytes).length > 0) throw new PicturesUploading()
  return next
}

function pictureFile(list: FileList | null | undefined): File | null {
  return list?.[0] ?? null
}

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea") !== null)
}

export function usePictureStore(): PictureStore {
  return useRef(pictureStore()).current
}

export function usePictureTool(
  enabled: boolean,
  store: PictureStore,
  onPicture: (picture: PictureFile) => Promise<void>,
) {
  const latest = useRef(onPicture)
  const [refused, setRefused] = useState<PictureRefusal | null>(null)
  useEffect(() => {
    latest.current = onPicture
  })
  useEffect(() => {
    if (refused === null) return
    const clear = window.setTimeout(() => setRefused(null), 6000)
    return () => window.clearTimeout(clear)
  }, [refused])
  const pick = useRef(async (file: Blob, handle?: typeof onPicture) => {
    const picture = await readPicture(file)
    setRefused(typeof picture === "string" ? picture : null)
    if (typeof picture !== "string") await (handle ?? latest.current)(picture)
  })
  useEffect(() => {
    if (!enabled) return
    function over(event: DragEvent) {
      if (event.dataTransfer?.types.includes("Files") === true) event.preventDefault()
    }
    function drop(event: DragEvent) {
      const file = pictureFile(event.dataTransfer?.files)
      if (file === null) return
      event.preventDefault()
      void pick.current(file)
    }
    function paste(event: ClipboardEvent) {
      if (typing(event.target)) return
      const file = pictureFile(event.clipboardData?.files)
      if (file === null) return
      event.preventDefault()
      void pick.current(file)
    }
    document.addEventListener("dragover", over)
    document.addEventListener("drop", drop)
    document.addEventListener("paste", paste)
    return () => {
      document.removeEventListener("dragover", over)
      document.removeEventListener("drop", drop)
      document.removeEventListener("paste", paste)
    }
  }, [enabled])
  const notice: ThinNotice | null = refused === null ? null : `picture-${refused}`
  return { notice, store, pick: (file: File, handle?: typeof onPicture) => void pick.current(file, handle) }
}
