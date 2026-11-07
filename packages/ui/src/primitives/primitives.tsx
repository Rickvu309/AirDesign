import { cloneElement, isValidElement, useState, useEffect, useId, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react"

import { Icon, type IconName } from "../icon/icon.tsx"

export { Icon, type IconName }
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
