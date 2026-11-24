import { useEffect, useState } from "react"

export type Natural = { readonly width: number; readonly height: number }

export function usePictureNatural(url: string | undefined): Natural | null {
  const [found, setFound] = useState<{ readonly url: string; readonly natural: Natural } | null>(null)
  useEffect(() => {
    if (url === undefined) return
    let current = true
    const image = new Image()
    image.onload = () => {
      if (current && image.naturalWidth > 0 && image.naturalHeight > 0)
        setFound({ url, natural: { width: image.naturalWidth, height: image.naturalHeight } })
    }
    image.src = url
    return () => {
      current = false
      image.onload = null
    }
  }, [url])
  return url !== undefined && found?.url === url ? found.natural : null
}
