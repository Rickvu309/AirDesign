import { cloneElement, isValidElement, useState, useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react"

export type IconName = "search" | "recent" | "decks" | "trash" | "settings" | "grid" | "list" | "chevron" | "plug" | "mail" | "plus"
const paths: Record<IconName, string> = {
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  recent: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  decks: "M7 7V3h14v14h-4M3 7h14v14H3z",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  settings: "M9 3h6l1 4 4 1v6l-4 1-1 4H9l-1-4-4-1V8l4-1zM15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  grid: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z",
  list: "M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1",
  chevron: "M7 10l5 5 5-5",
  plug: "M9 3v5M15 3v5M6 8h12v5a6 6 0 0 1-12 0zM12 19v3",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  plus: "M12 4v16M4 12h16",
}
export function Icon({ name }: { name: IconName }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>
}
export function BrandMark() {
  return <svg className="ad-brand-mark" width="42" height="42" viewBox="0 0 64 64" fill="none" role="img" aria-label="AirDesign"><path d="M13 57l19-50 19 50" stroke="var(--logo-ink)" strokeWidth="3.063" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 44l52-14" stroke="var(--logo-accent)" strokeWidth="2.188" strokeLinecap="round"/></svg>
}
export function IconButton({ label, icon, ...props }: { label: string; icon: IconName } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" aria-label={label} title={label} className="ad-icon-button" {...props}><Icon name={icon}/></button>
}
export function Card({ children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section {...props} className="ad-module-card">{children}</section>
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="ad-badge">{children}</span>
}
export function Avatar({ name }: { name: string }) {
  return <span className="ad-avatar" aria-hidden="true">{name.split(/\s+/).map(word => word[0]).slice(0, 2).join("")}</span>
}
export function SearchField({ value, onChange, label = "Search" }: { value: string; onChange: (value: string) => void; label?: string }) {
  return <label className="ad-search"><Icon name="search"/><input aria-label={label} placeholder={label} type="search" enterKeyHint="search" autoCapitalize="none" autoCorrect="off" value={value} onChange={event => onChange(event.target.value)}/></label>
}
export function SegmentedControl<T extends string>({ label, value, items, onChange }: { label: string; value: T; items: readonly { value: T; label: string; icon?: IconName }[]; onChange: (value: T) => void }) {
  return <div className="ad-segmented" role="group" aria-label={label}>{items.map(item => <button type="button" key={item.value} aria-label={item.label} aria-pressed={item.value === value} onClick={() => onChange(item.value)}>{item.icon ? <Icon name={item.icon}/> : item.label}</button>)}</div>
}
export function NavItem({ label, icon, href, selected, onSelect }: { label: string; icon: IconName; href: string; selected: boolean; onSelect?: () => void }) {
  return <a href={href} className="ad-nav-item" onClick={event => {
    if (onSelect && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      onSelect()
    }
  }} aria-current={selected ? "page" : undefined}><Icon name={icon}/>{label}</a>
}
export function Dropdown({ label, trigger, children }: { label: string; trigger: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) ref.current.open = false
    }
    document.addEventListener("pointerdown", dismiss)
    return () => document.removeEventListener("pointerdown", dismiss)
  }, [])
  return <details ref={ref} className="ad-dropdown" onClick={event => { if (event.target instanceof Element && event.target.closest(".ad-menu a,.ad-menu button")) { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus() } }} onKeyDown={event => { if (event.key === "Escape") { event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus() } }}><summary aria-label={label}>{trigger}</summary><div className="ad-menu">{children}</div></details>
}
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setDismissed(true) }
    document.addEventListener("keydown", dismiss)
    return () => document.removeEventListener("keydown", dismiss)
  }, [])
  const trigger = isValidElement<HTMLAttributes<HTMLElement>>(children) ? cloneElement(children, { "aria-describedby": [children.props["aria-describedby"], id].filter(Boolean).join(" ") }) : children
  return <span className="ad-tooltip" onFocus={() => setDismissed(false)} onMouseEnter={() => setDismissed(false)}>{trigger}<span role="tooltip" id={id} hidden={dismissed}>{label}</span></span>
}
export function EmptyState({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return <section className="ad-empty"><h2>{title}</h2><p>{body}</p>{children}</section>
}
