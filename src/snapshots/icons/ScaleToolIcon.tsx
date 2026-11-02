import type { AirDesignProps } from "../types.js";

export function ScaleToolIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
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
  }} width="24" height="24" fill="none" viewBox="0 0 24 24" className={className} {...rest}>
                <path style={{
      "fill": "var(--ad-surface, rgb(255, 255, 255))"
    }} d="M14.5 9a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-1.793l-2.148 2.147c.093.196.148.415.148.646v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 6 16.5v-3A1.5 1.5 0 0 1 7.5 12h3c.231 0 .449.054.645.148L13.293 10H11.5a.5.5 0 0 1 0-1zM16 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2a.5.5 0 0 1 0-1h2a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a.5.5 0 0 1-1 0V8a2 2 0 0 1 2-2zm-8.5 7a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5z"></path>
              </svg>;
}
