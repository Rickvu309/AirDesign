import type { AirDesignProps } from "../types.js";

export function MediaSlideViewButton({
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
  }} aria-label="Slide view" type="button" className={className} {...rest}>
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
        }} d="M19.5 19a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1zM19 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM5 15h14V9H5zM19.5 4a.5.5 0 0 1 0 1h-15a.5.5 0 0 1 0-1z"></path>
  </svg>
</span>
                </button>;
}
