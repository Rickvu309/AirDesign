import type { AirDesignComponentProps } from "../types.ts";

export function HomeFolderIcon2({
  style,
  className
}: AirDesignComponentProps) {
  return <svg style={{
    "display": "block",
    "height": "24px",
    "overflowX": "hidden",
    "overflowY": "hidden",
    position: "relative",
    fontFamily: "Inter, sans-serif",
    fontSize: 11,
    lineHeight: "16px",
    boxSizing: "border-box",
    flexShrink: 0,
    width: 24,
    ...style
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className}>
              <path style={{
      "fill": "rgb(175, 188, 207)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M10.379 6a2 2 0 0 1 1.414.586L13.207 8H16.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM8.5 14a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1z"></path>
            </svg>;
}
