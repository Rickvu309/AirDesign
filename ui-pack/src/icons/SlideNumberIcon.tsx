import type { AirDesignComponentProps } from "../types.ts";

export function SlideNumberIcon({
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
      "fill": "rgba(0, 0, 0, 0.898)"
    }} fill="var(--fpl-icon-color, var(--color-icon))" d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m0 1a8 8 0 1 0 0 16 8 8 0 0 0 0-16m3.056 3.003a.5.5 0 0 1 .441.553L15.336 9H16.5a.5.5 0 0 1 0 1h-1.274l-.445 4H16.5a.5.5 0 0 1 0 1h-1.83l-.173 1.556a.5.5 0 0 1-.994-.112L13.664 15H9.67l-.173 1.556a.5.5 0 0 1-.994-.112L8.664 15H7.5a.5.5 0 0 1 0-1h1.274l.445-4H7.5a.5.5 0 0 1 0-1h1.83l.173-1.556a.5.5 0 0 1 .994.112L10.336 9h3.994l.173-1.556a.5.5 0 0 1 .553-.441M9.78 14h3.993l.445-4h-3.993z"></path>
      </svg>;
}
