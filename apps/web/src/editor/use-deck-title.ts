import { renameDeck } from "@airdesign/live"
import { useCallback, useEffect } from "react"
import { tabTitleOf } from "@/copy/product-copy"

export function useDeckTitle(id: string, title: string, setTitle: (title: string) => void): (name: string) => void {
  useEffect(() => {
    if (title === "") return
    const before = document.title
    document.title = tabTitleOf(title)
    return () => {
      document.title = before
    }
  }, [title])
  return useCallback(
    (name: string) => {
      setTitle(name)
      void renameDeck(id, name)
    },
    [id, setTitle],
  )
}
