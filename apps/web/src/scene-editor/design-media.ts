import { flushMedia, keepMedia, readMedia } from "@airdesign/live"
import { useEffect, useState } from "react"
import { readPicture } from "@/picture-file"

const sha = /^[0-9a-f]{64}$/

export async function storePicture(deck: string, file: Blob): Promise<string | null> {
  const picture = await readPicture(file)
  if (typeof picture === "string") return null
  const asset = await keepMedia(deck, picture.bytes)
  void flushMedia(deck)
  return asset
}

export function useAssetUrl(deck: string, asset: string | undefined): string | null {
  const [shown, setShown] = useState<{ readonly asset: string; readonly url: string } | null>(null)
  useEffect(() => {
    if (asset === undefined || !sha.test(asset)) return
    let current = true
    let made: string | null = null
    void readMedia(deck, [asset]).then((found) => {
      const bytes = found.get(asset)
      if (!current || bytes === undefined) return
      made = URL.createObjectURL(new Blob([new Uint8Array(bytes)]))
      setShown({ asset, url: made })
    })
    return () => {
      current = false
      if (made !== null) URL.revokeObjectURL(made)
    }
  }, [deck, asset])
  return asset !== undefined && shown?.asset === asset ? shown.url : null
}
