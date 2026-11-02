import type { AirDesignProps } from "../types.js";

export function FileGridViewButton({
  style,
  className,
  ...rest
}: AirDesignProps<"button">) {
  return <button style={{
    "alignItems": "center",
    "appearance": "auto",
    "backgroundColor": "rgba(0, 0, 0, 0)",
    "color": "var(--ad-ink-strong, rgb(0, 0, 0))",
    "display": "grid",
    "fontFamily": "Inter, sans-serif",
    "fontSize": "11px",
    "fontWeight": "400",
    "gridTemplateColumns": "24px",
    "gridTemplateRows": "24px",
    "height": "24px",
    "justifyItems": "center",
    "lineHeight": "16px",
    "minWidth": "24px",
    "outlineColor": "rgba(0, 0, 0, 0)",
    "outlineOffset": "-1px",
    "outlineStyle": "solid",
    "outlineWidth": "1px",
    "textAlign": "start",
    "width": "24px",
    "borderRadius": "5px",
    "padding": "0px",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
    ...style
  }} aria-label="Grid view" type="button" className={className} {...rest}>
                    <span style={{
      "alignItems": "center",
      "display": "flex",
      "height": "24px",
      "justifyContent": "center",
      "minWidth": "24px",
      "width": "24px",
      "borderRadius": "5px"
    }} aria-hidden="true">
  <svg style={{
        "display": "block",
        "height": "24px",
        "overflowX": "hidden",
        "overflowY": "hidden",
        "width": "24px"
      }} width="24" height="24" fill="none" viewBox="0 0 24 24">
    <path style={{
          "fill": "var(--ad-icon, var(--ad-ink, rgba(0, 0, 0, 0.898)))"
        }} fillRule="evenodd" d="M5 6h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M3 7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm12-1h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zm6 7h-4a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1m-4-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2zM5 14h4a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1m-2 1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" clipRule="evenodd"></path>
  </svg>
</span>
                  </button>;
}
