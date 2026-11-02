import type { AirDesignProps } from "../types.ts";

export function TableIcon({
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
      "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
    }} fillRule="evenodd" d="M4 14v-4h5v4zm-1 1V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm1-6h5V5H5a1 1 0 0 0-1 1zm6-4v4h10V6a1 1 0 0 0-1-1zm10 5H10v4h10zm0 5H10v4h9a1 1 0 0 0 1-1zM9 19H5a1 1 0 0 1-1-1v-3h5z" clipRule="evenodd"></path>
    </svg>;
}
