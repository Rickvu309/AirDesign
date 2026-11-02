import type { AirDesignProps } from "../types.js";

export function SlidesIcon({
  style,
  className,
  ...rest
}: AirDesignProps<"svg">) {
  return <svg style={{
    "display": "block",
    "height": "16px",
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
  }} width="16" height="16" fill="none" viewBox="0 0 16 16" className={className} {...rest}>
  <path style={{
      "fill": "var(--ad-surface, rgb(255, 255, 255))"
    }} fillRule="evenodd" d="M4 4h8a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1m.434 8H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.434l.412 1.354a.5.5 0 1 1-.956.292L10.52 12H5.479l-.5 1.646a.5.5 0 1 1-.957-.292zM5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2" clipRule="evenodd"></path>
</svg>;
}
