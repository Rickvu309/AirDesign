import type { ComponentProps, KeyboardEvent } from "react";
import { Divider } from "./Divider.js";
import { cx } from "../lib/cx.js";

export type ToolbarProps = ComponentProps<"div"> & { label: string; orientation?: "horizontal" | "vertical" };

const items = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>("button:not(:disabled), [role=button]:not([aria-disabled=true])")];

/** Toolbar with a single tab stop: Arrow keys, Home and End move between its buttons. */
export function Toolbar({ label, orientation = "horizontal", className, onKeyDown, ...rest }: ToolbarProps) {
  const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
  const prev = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
  const handle = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const list = items(e.currentTarget);
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const target = e.key === next ? list[(at + 1) % list.length] : e.key === prev ? list[(at - 1 + list.length) % list.length] : e.key === "Home" ? list[0] : e.key === "End" ? list[list.length - 1] : undefined;
    if (!target) return;
    e.preventDefault();
    list.forEach((b) => b.setAttribute("tabindex", b === target ? "0" : "-1"));
    target.focus();
  };
  return <div role="toolbar" aria-label={label} aria-orientation={orientation} className={cx("ad ad-toolbar", `ad-toolbar--${orientation}`, className)} onKeyDown={handle} {...rest} />;
}

export function ToolbarGroup({ className, ...rest }: ComponentProps<"div">) {
  return <div role="group" className={cx("ad-toolbar__group", className)} {...rest} />;
}

export function ToolbarSeparator() {
  return <Divider orientation="vertical" style={{ height: 20, alignSelf: "center" }} />;
}
