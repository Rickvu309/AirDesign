import { useCallback, useEffect, useRef, useState } from "react"

const latestSlack = 8

export function useConversationFollow(key: unknown) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const [away, setAway] = useState(false)

  const toLatest = useCallback(() => {
    following.current = true
    setAway(false)
    const box = viewport.current
    if (box !== null) box.scrollTop = box.scrollHeight
  }, [])

  useEffect(() => {
    const box = viewport.current
    const inner = content.current
    if (box === null || inner === null) return
    const observer = new ResizeObserver(() => {
      if (following.current) box.scrollTop = box.scrollHeight
    })
    observer.observe(box)
    observer.observe(inner)
    return () => observer.disconnect()
  }, [key])

  const onScroll = useCallback(() => {
    const box = viewport.current
    if (box === null) return
    const atLatest = box.scrollHeight - box.scrollTop - box.clientHeight <= latestSlack
    following.current = atLatest
    setAway(!atLatest)
  }, [])

  return { viewport, content, away, toLatest, onScroll }
}
