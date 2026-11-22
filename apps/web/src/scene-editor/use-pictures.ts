import { mediaTypeOf, scene } from "@airdesign/document"
import { flushMedia, keepMedia, readMedia } from "@airdesign/live"
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react"
import { pictureCopy } from "@/copy/picture-copy"
import { toast } from "@/components/ui/toast"
import { readPicture } from "@/picture-file"
import { pictureWrites } from "./picture-writes"
import type { Point } from "./slide-geometry"
import type { EditorClient } from "./use-scene-deck"

const sha = /^[0-9a-f]{64}$/

function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea") !== null)
}

function assetsIn(view: scene.Scene): readonly string[] {
  const found = new Set<string>()
  for (const node of view.nodes.values()) {
    const fills = (node as { readonly fills?: readonly scene.Paint[] }).fills ?? []
    for (const paint of fills) if (paint.kind === "image" && sha.test(paint.asset)) found.add(paint.asset)
  }
  return [...found]
}

export type Pictures = {
  readonly assetUrl: (asset: string) => string | undefined
  readonly drop: (event: DragEvent) => void
  readonly over: (event: DragEvent) => void
}

export function useScenePictures(args: {
  readonly deck: string
  readonly client: EditorClient
  readonly view: scene.Scene
  readonly slide: scene.NodeId
  readonly slideBox: RefObject<HTMLDivElement | null>
  readonly scale: number
  readonly onPlaced: (id: scene.NodeId) => void
}): Pictures {
  const { deck, view } = args
  const urls = useRef(new Map<string, string>())
  const asked = useRef(new Set<string>())
  const [version, setVersion] = useState(0)
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })

  const keepUrl = useCallback((asset: string, bytes: Uint8Array) => {
    if (urls.current.has(asset)) return
    const type = mediaTypeOf(bytes) ?? "application/octet-stream"
    urls.current.set(asset, URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type })))
    setVersion((was) => was + 1)
  }, [])

  useEffect(() => {
    const kept = urls.current
    return () => {
      for (const url of kept.values()) URL.revokeObjectURL(url)
      kept.clear()
    }
  }, [])

  useEffect(() => {
    void flushMedia(deck)
    const again = () => void flushMedia(deck)
    window.addEventListener("online", again)
    return () => window.removeEventListener("online", again)
  }, [deck])

  useEffect(() => {
    const wanted = assetsIn(view).filter((asset) => !asked.current.has(asset))
    if (wanted.length === 0) return
    for (const asset of wanted) asked.current.add(asset)
    void readMedia(deck, wanted).then((found) => {
      for (const [asset, bytes] of found) keepUrl(asset, bytes)
      for (const asset of wanted) if (!found.has(asset)) asked.current.delete(asset)
    })
  }, [deck, view, keepUrl])

  const place = useCallback(
    async (file: Blob, at: Point | null) => {
      const picture = await readPicture(file)
      if (typeof picture === "string") {
        toast.refusal(pictureCopy[`picture-${picture}`], { id: "picture-refused" })
        return
      }
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

  const assetUrl = useMemo(() => (asset: string) => urls.current.get(asset), [version])
  return { assetUrl, drop, over }
}
