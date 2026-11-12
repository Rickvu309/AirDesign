import type { Register } from "@airdesign/document"
import { readMedia } from "@airdesign/live"
import { useEffect, useRef, useState } from "react"
import { missingPictures, type PictureBytes } from "@/exported-parts"
import { readPicture, type PictureFile, type PictureRefusal } from "@/picture-add"
import type { ThinNotice } from "@/thin-notice"

export type PictureStore = {
  readonly bytes: PictureBytes
  load(deck: string, register: Register | null): Promise<boolean>
  keep(sha256: string, bytes: Uint8Array): void
}

export class PicturesUploading extends Error {
  constructor() {
    super("pictures")
    this.name = "PicturesUploading"
  }
}

export function pictureStore(read: typeof readMedia = readMedia): PictureStore {
  const bytes = new Map<string, Uint8Array>()
  return {
    bytes,
    async load(deck, register) {
      if (register === null) return false
      const missing = missingPictures(register, bytes)
      if (missing.length === 0) return false
      const found = await read(deck, missing)
      for (const [sha256, each] of found) bytes.set(sha256, each)
      return found.size > 0
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

function pictureFile(list: FileList | null | undefined): File | null {
  return list?.[0] ?? null
}

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea") !== null)
}

export function usePictureTool(enabled: boolean, onPicture: (picture: PictureFile) => Promise<void>) {
  const latest = useRef(onPicture)
  const [refused, setRefused] = useState<PictureRefusal | null>(null)
  const store = useRef(pictureStore()).current
  useEffect(() => {
    latest.current = onPicture
  })
  useEffect(() => {
    if (refused === null) return
    const clear = window.setTimeout(() => setRefused(null), 6000)
    return () => window.clearTimeout(clear)
  }, [refused])
  const pick = useRef(async (file: Blob) => {
    const picture = await readPicture(file)
    setRefused(typeof picture === "string" ? picture : null)
    if (typeof picture !== "string") await latest.current(picture)
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
  return { notice, store, pick: (file: File) => void pick.current(file) }
}
