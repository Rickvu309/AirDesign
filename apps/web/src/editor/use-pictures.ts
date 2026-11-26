import * as doom from "@airdesign/doom"
import { flushMedia, keepMedia } from "@airdesign/live"
import { useCallback, useEffect, useRef, useState, type DragEvent, type RefObject } from "react"
import { readPicture } from "@/editing/picture-file"
import type { ThinNotice } from "./thin-notice"
import { pictureWrites } from "./picture-writes"
import type { Point } from "./slide-geometry"
import type { EditorClient } from "./use-deck"

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea") !== null)
}

export type Pictures = {
  readonly assetUrl: (asset: string) => string | undefined
  readonly drop: (event: DragEvent) => void
  readonly over: (event: DragEvent) => void
  readonly add: (file: Blob) => void
  readonly notice: ThinNotice | null
}

export function useDoomPictures(args: {
  readonly deck: string
  readonly client: EditorClient
  readonly assetUrl: (asset: string) => string | undefined
  readonly keepUrl: (asset: string, bytes: Uint8Array) => void
  readonly slide: doom.NodeId
  readonly slideBox: RefObject<HTMLDivElement | null>
  readonly scale: number
  readonly onPlaced: (id: doom.NodeId) => void
}): Pictures {
  const { keepUrl, assetUrl } = args
  const [notice, setNotice] = useState<ThinNotice | null>(null)
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })

  useEffect(() => {
    if (notice === null) return
    const clear = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(clear)
  }, [notice])

  const place = useCallback(
    async (file: Blob, at: Point | null) => {
      const picture = await readPicture(file)
      if (typeof picture === "string") {
        setNotice(`picture-${picture}`)
        return
      }
      setNotice(null)
      const asset = await keepMedia(latest.current.deck, picture.bytes)
      keepUrl(asset, picture.bytes)
      const now = latest.current
      const id = now.client.mint()
      const pushed = now.client.push(pictureWrites(now.client.view(), now.slide, id, asset, picture, at))
      if (!pushed.ok) return
      now.onPlaced(id)
      void flushMedia(now.deck)
    },
    [keepUrl],
  )

  useEffect(() => {
    function paste(event: ClipboardEvent) {
      if (typing(event.target)) return
      const file = event.clipboardData?.files[0]
      if (file === undefined) return
      event.preventDefault()
      void place(file, null)
    }
    document.addEventListener("paste", paste)
    return () => document.removeEventListener("paste", paste)
  }, [place])

  const over = useCallback((event: DragEvent) => {
    if (event.dataTransfer?.types.includes("Files") === true) event.preventDefault()
  }, [])

  const drop = useCallback(
    (event: DragEvent) => {
      const file = event.dataTransfer?.files[0]
      if (file === undefined) return
      event.preventDefault()
      const box = latest.current.slideBox.current?.getBoundingClientRect()
      const scale = latest.current.scale
      const at =
        box === undefined ? null : { x: (event.clientX - box.left) / scale, y: (event.clientY - box.top) / scale }
      void place(file, at)
    },
    [place],
  )

  const add = useCallback(
    (file: Blob) => {
      void place(file, null)
    },
    [place],
  )

  return { assetUrl, drop, over, add, notice }
}
