import { useState } from "react"
import type { KeyboardEvent } from "react"

export type ToolbarItem = {
  id: string
  label: string
  onSelect: () => void
}

type ToolbarProps = {
  label: string
  items: readonly ToolbarItem[]
}

export function Toolbar({ label, items }: ToolbarProps) {
  const [active, setActive] = useState(0)
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) {
      return
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      setActive((index) => (index + 1) % items.length)
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      setActive((index) => (index - 1 + items.length) % items.length)
    }
  }
  return (
    <div role="toolbar" aria-label={label} className="ad-toolbar" onKeyDown={onKeyDown}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className="ad-button ad-button-secondary ad-button-compact ad-toolbar-item"
          tabIndex={index === active ? 0 : -1}
          aria-current={index === active ? "true" : undefined}
          onClick={() => {
            setActive(index)
            item.onSelect()
          }}
          onFocus={() => setActive(index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
