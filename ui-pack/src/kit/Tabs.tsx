import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx.ts";

export interface TabItem { id: string; label: ReactNode; disabled?: boolean }
export interface TabsProps {
  items: TabItem[];
  /** Controlled value. Omit for uncontrolled with `defaultValue`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}

/** Segmented tabs with roving focus: Arrow keys, Home and End move between enabled tabs. */
export function Tabs({ items, value, defaultValue, onValueChange, label, className }: TabsProps) {
  const [inner, setInner] = useState(defaultValue ?? items.find((i) => !i.disabled)?.id);
  const current = value ?? inner;
  const base = useId();
  const select = (id: string) => { if (value === undefined) setInner(id); onValueChange?.(id); };
  const enabled = items.filter((i) => !i.disabled);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const at = enabled.findIndex((i) => i.id === current);
    const next = e.key === "ArrowRight" ? enabled[(at + 1) % enabled.length] : e.key === "ArrowLeft" ? enabled[(at - 1 + enabled.length) % enabled.length] : e.key === "Home" ? enabled[0] : e.key === "End" ? enabled[enabled.length - 1] : undefined;
    if (!next) return;
    e.preventDefault();
    select(next.id);
    document.getElementById(`${base}-${next.id}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={cx("ad ad-tabs", className)}>
      {items.map((item) => (
        <button
          key={item.id}
          id={`${base}-${item.id}`}
          role="tab"
          type="button"
          className="ad-tab"
          aria-selected={item.id === current}
          tabIndex={item.id === current ? 0 : -1}
          disabled={item.disabled}
          onClick={() => select(item.id)}
          onKeyDown={onKeyDown}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
