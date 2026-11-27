import * as doom from "@airdesign/doom"
import { readMedia } from "@airdesign/live"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

const sha = /^[0-9a-f]{64}$/

function assetsIn(view: doom.Doom): readonly string[] {
  const found = new Set<string>()
  for (const node of view.nodes.values()) {
    const fills = (node as { readonly fills?: readonly doom.Paint[] }).fills ?? []
    for (const paint of fills) if (paint.kind === "image" && sha.test(paint.asset)) found.add(paint.asset)
  }
  return [...found]
}

export type AssetSource = {
  readonly read: typeof readMedia
  readonly url: (bytes: Uint8Array, type: string) => string
}

export const deviceAssets: AssetSource = {
  read: readMedia,
  url: (bytes, type) => URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type })),
}

export type AssetUrls = {
  readonly assetUrl: (asset: string) => string | undefined
  readonly keepUrl: (asset: string, bytes: Uint8Array) => void
}

export function useAssetUrls(deck: string, view: doom.Doom, source = deviceAssets): AssetUrls {
  const urls = useRef(new Map<string, string>())
  const asked = useRef(new Set<string>())
  const [version, setVersion] = useState(0)

  const keepUrl = useCallback(
    (asset: string, bytes: Uint8Array) => {
      if (urls.current.has(asset)) return
      urls.current.set(asset, source.url(bytes, doom.mediaTypeOf(bytes) ?? "application/octet-stream"))
      setVersion((was) => was + 1)
    },
    [source],
  )

  useEffect(() => {
    const kept = urls.current
    return () => {
      for (const url of kept.values()) URL.revokeObjectURL(url)
      kept.clear()
    }
  }, [])

  useEffect(() => {
    const wanted = assetsIn(view).filter((asset) => !asked.current.has(asset))
    if (wanted.length === 0) return
    for (const asset of wanted) asked.current.add(asset)
    void source.read(deck, wanted).then((found) => {
      for (const [asset, bytes] of found) keepUrl(asset, bytes)
      for (const asset of wanted) if (!found.has(asset)) asked.current.delete(asset)
    })
  }, [deck, view, source, keepUrl])

  const assetUrl = useMemo(() => (asset: string) => urls.current.get(asset), [version])
  return { assetUrl, keepUrl }
}
